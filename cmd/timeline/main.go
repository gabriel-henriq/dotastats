package main

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type Hero struct {
	Name          string `json:"name"`
	Key           string `json:"key"`
	HeroID        int    `json:"heroId"`
	MovementSpeed int    `json:"movementSpeed"`
	Icon          string `json:"icon"`
	AddedPatch    string `json:"addedPatch"`
}

type PatchSnapshot struct {
	Patch  string            `json:"patch"`
	Speeds map[string]int    `json:"speeds"` // heroKey -> movespeed
	Changes []PatchChange    `json:"changes,omitempty"`
}

type PatchChange struct {
	Hero string `json:"hero"`
	From int    `json:"from"`
	To   int    `json:"to"`
}

type TimelineData struct {
	Heroes    []Hero          `json:"heroes"`
	Snapshots []PatchSnapshot `json:"snapshots"`
}

var (
	// "Movement speed increased from 315 to 320"
	reFromTo = regexp.MustCompile(`(?i)(?:base )?move?ment ?speed (?:increased|reduced|decreased|changed) from (\d+) to (\d+)`)
	// "Base movement speed reduced by 5"
	reByN = regexp.MustCompile(`(?i)(?:base )?move?ment ?speed (?:increased|reduced|decreased) by (\d+)`)
	// Patch key: DOTA_Patch_7_06d_bounty_hunter
	rePatchKey = regexp.MustCompile(`^DOTA_Patch_(\d+_\d+[a-z]*)_(.+?)(?:_\d+)?$`)
)

func main() {
	heroData, _ := os.ReadFile("data/heroes.json")
	var heroes []Hero
	json.Unmarshal(heroData, &heroes)

	heroByName := map[string]*Hero{}
	for i := range heroes {
		heroByName[heroes[i].Name] = &heroes[i]
	}

	patchData, _ := os.ReadFile("data/patchnotes_english.txt")
	content := strings.ReplaceAll(string(patchData), "\r", "")

	// Heroes added during our patch range (7.06d–7.41).
	// All other heroes (HeroID <= 114) existed before 7.06d.
	heroIntroPatches := map[string]string{
		"dark_willow":  "7.07",
		"pangolier":    "7.07",
		"grimstroke":   "7.19",
		"mars":         "7.21",
		"snapfire":     "7.23",
		"void_spirit":  "7.23",
		"hoodwink":     "7.28",
		"dawnbreaker":  "7.29",
		"marci":        "7.30",
		"primal_beast": "7.31",
		"muerta":       "7.33",
		"ringmaster":   "7.37",
		"kez":          "7.38",
		"largo":        "7.40",
	}
	for name, patch := range heroIntroPatches {
		if h, ok := heroByName[name]; ok {
			h.AddedPatch = patch
		}
	}

	// Parse all movespeed changes
	type msChange struct {
		patch    string
		hero     string // hero short name
		newSpeed int    // absolute, or 0 if delta
		delta    int    // +/- delta
		increase bool
	}

	var changes []msChange
	patchOrder := []string{}
	patchSeen := map[string]bool{}

	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "\"DOTA_Patch_") {
			continue
		}

		// Extract key and value
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) < 2 {
			// Try splitting on multiple whitespace
			idx := strings.Index(line[1:], "\"")
			if idx < 0 {
				continue
			}
			key := line[1 : idx+1]
			rest := strings.TrimSpace(line[idx+2:])
			if !strings.HasPrefix(rest, "\"") {
				continue
			}
			vEnd := strings.LastIndex(rest, "\"")
			if vEnd <= 0 {
				continue
			}
			parts = []string{"\"" + key + "\"", rest}
		}

		keyStr := strings.Trim(strings.TrimSpace(parts[0]), "\"")
		valStr := strings.Trim(strings.TrimSpace(parts[len(parts)-1]), "\"")

		// Skip talent, ability-specific, item changes
		valLower := strings.ToLower(valStr)
		if strings.Contains(valLower, "talent") || strings.Contains(valLower, "level ") {
			continue
		}

		// Must contain movement speed
		if !strings.Contains(valLower, "movement speed") && !strings.Contains(valLower, "movespeed") {
			continue
		}

		// Parse the key
		m := rePatchKey.FindStringSubmatch(keyStr)
		if m == nil {
			continue
		}

		patchVer := m[1]
		heroName := m[2]

		// Normalize patch version: 7_06d -> 7.06d
		patchVer = strings.Replace(patchVer, "_", ".", 1)

		if !patchSeen[patchVer] {
			patchSeen[patchVer] = true
			patchOrder = append(patchOrder, patchVer)
		}

		// Skip ability-specific changes (key has ability name after hero)
		// Heuristic: if heroName contains an ability-like pattern, skip
		if _, ok := heroByName[heroName]; !ok {
			// Could be hero_2, hero_3 suffix
			base := regexp.MustCompile(`_\d+$`).ReplaceAllString(heroName, "")
			if _, ok := heroByName[base]; !ok {
				// Check for General/bulk changes
				if heroName != "General" {
					continue
				}
			} else {
				heroName = base
			}
		}

		// Parse the change
		if mft := reFromTo.FindStringSubmatch(valStr); mft != nil {
			from, _ := strconv.Atoi(mft[1])
			to, _ := strconv.Atoi(mft[2])
			_ = from
			if heroName == "General" {
				continue // handle General separately below
			}
			changes = append(changes, msChange{
				patch:    patchVer,
				hero:     heroName,
				newSpeed: to,
			})
		} else if mbn := reByN.FindStringSubmatch(valStr); mbn != nil {
			n, _ := strconv.Atoi(mbn[1])
			increase := strings.Contains(valLower, "increased")
			if !increase {
				n = -n
			}
			if heroName == "General" {
				// Bulk change - handled separately
				changes = append(changes, msChange{
					patch: patchVer,
					hero:  "_general",
					delta: n,
				})
				continue
			}
			changes = append(changes, msChange{
				patch: patchVer,
				hero:  heroName,
				delta: n,
			})
		}
	}

	// Sort patches by version
	sort.Slice(patchOrder, func(i, j int) bool {
		return comparePatchVersions(patchOrder[i], patchOrder[j])
	})

	// Build timeline: start with current speeds, then work backwards?
	// Actually, we need to go forward from the earliest patch.
	// Current heroes.json has the LATEST speeds.
	// Strategy: apply changes in reverse from current state to reconstruct historical speeds.

	// Group changes by patch
	patchChanges := map[string][]msChange{}
	for _, c := range changes {
		patchChanges[c.patch] = append(patchChanges[c.patch], c)
	}

	// Build hero added patch lookup
	heroAddedPatch := map[string]string{}
	for _, h := range heroes {
		heroAddedPatch[h.Name] = h.AddedPatch // "" means existed before our earliest patch
	}

	// Build snapshots going backwards from current
	currentSpeeds := map[string]int{}
	for _, h := range heroes {
		currentSpeeds[h.Name] = h.MovementSpeed
	}

	// First pass: collect changes per patch (from→to) going backwards
	type patchResult struct {
		patch   string
		speeds  map[string]int
		changes []PatchChange
	}

	var results []patchResult
	speeds := copyMap(currentSpeeds)

	for i := len(patchOrder) - 1; i >= 0; i-- {
		patch := patchOrder[i]
		pChanges := patchChanges[patch]

		var snapshotChanges []PatchChange

		for _, c := range pChanges {
			if c.hero == "_general" {
				for name := range speeds {
					speeds[name] -= c.delta
				}
				continue
			}

			if _, ok := speeds[c.hero]; !ok {
				continue
			}

			afterSpeed := speeds[c.hero]
			if c.newSpeed > 0 {
				speeds[c.hero] = findFromSpeed(patchData, patch, c.hero, c.newSpeed)
				if speeds[c.hero] != afterSpeed {
					snapshotChanges = append(snapshotChanges, PatchChange{
						Hero: c.hero,
						From: speeds[c.hero],
						To:   afterSpeed,
					})
				}
			} else if c.delta != 0 {
				speeds[c.hero] -= c.delta
				if speeds[c.hero] != afterSpeed {
					snapshotChanges = append(snapshotChanges, PatchChange{
						Hero: c.hero,
						From: speeds[c.hero],
						To:   afterSpeed,
					})
				}
			}
		}

		results = append(results, patchResult{
			patch:   patch,
			changes: snapshotChanges,
		})
	}

	// Reverse results so earliest is first
	for i, j := 0, len(results)-1; i < j; i, j = i+1, j-1 {
		results[i], results[j] = results[j], results[i]
	}

	// Build snapshots forward: start from reconstructed earliest speeds,
	// apply changes forward to compute each patch's state
	snapshots := []PatchSnapshot{}
	fwdSpeeds := copyMap(speeds) // speeds after fully unwinding = earliest state

	for _, r := range results {
		// Snapshot BEFORE applying this patch's changes = state at this patch
		// But we want the snapshot to show the state AFTER this patch,
		// with the changes that happened IN this patch.
		// Apply changes forward
		for _, c := range r.changes {
			fwdSpeeds[c.Hero] = c.To
		}

		snapshots = append(snapshots, PatchSnapshot{
			Patch:   r.patch,
			Speeds:  filterSpeedsByPatch(fwdSpeeds, heroAddedPatch, r.patch),
			Changes: r.changes,
		})

		fwdSpeeds = copyMap(fwdSpeeds)
	}

	timeline := TimelineData{
		Heroes:    heroes,
		Snapshots: snapshots,
	}

	out, _ := json.MarshalIndent(timeline, "", "  ")
	os.WriteFile("data/timeline.json", out, 0644)
	os.WriteFile("web/public/timeline.json", out, 0644)

	fmt.Printf("Generated %d patch snapshots\n", len(snapshots))
	fmt.Printf("Patches: %s ... %s\n", patchOrder[0], patchOrder[len(patchOrder)-1])

	// Print some stats
	changeCount := 0
	for _, s := range snapshots {
		changeCount += len(s.Changes)
	}
	fmt.Printf("Total movespeed changes tracked: %d\n", changeCount)
}

func findFromSpeed(patchData []byte, patch, hero string, toSpeed int) int {
	content := string(patchData)
	// Search for the specific patch note to get the "from" value
	patchKey := "DOTA_Patch_" + strings.Replace(patch, ".", "_", 1) + "_" + hero

	idx := strings.Index(content, patchKey)
	if idx < 0 {
		// Try with _2, _3 suffixes
		for suffix := 2; suffix <= 5; suffix++ {
			idx = strings.Index(content, fmt.Sprintf("%s_%d", patchKey, suffix))
			if idx >= 0 {
				break
			}
		}
	}

	if idx >= 0 {
		// Get the line
		lineEnd := strings.Index(content[idx:], "\n")
		if lineEnd > 0 {
			line := content[idx : idx+lineEnd]
			m := reFromTo.FindStringSubmatch(line)
			if m != nil {
				from, _ := strconv.Atoi(m[1])
				return from
			}
		}
	}

	// If we can't find the "from" value, estimate it
	return toSpeed
}

func copyMap(m map[string]int) map[string]int {
	c := make(map[string]int, len(m))
	for k, v := range m {
		c[k] = v
	}
	return c
}

func comparePatchVersions(a, b string) bool {
	ap := parsePatchVer(a)
	bp := parsePatchVer(b)
	if ap[0] != bp[0] {
		return ap[0] < bp[0]
	}
	if ap[1] != bp[1] {
		return ap[1] < bp[1]
	}
	return ap[2] < bp[2]
}

func parsePatchVer(v string) [3]string {
	// 7.06d -> [7, 06, d]
	// 7.20  -> [7, 20, ""]
	parts := strings.SplitN(v, ".", 2)
	major := parts[0]
	minor := ""
	suffix := ""
	if len(parts) > 1 {
		// Split number from letter suffix
		rest := parts[1]
		i := 0
		for i < len(rest) && (rest[i] >= '0' && rest[i] <= '9') {
			i++
		}
		minor = rest[:i]
		suffix = rest[i:]
	}
	return [3]string{major, fmt.Sprintf("%04s", minor), suffix}
}

func findHeroIntroPatches(content string, heroByName map[string]*Hero) map[string]string {
	// For each hero, find the earliest patch version where they appear in patch notes.
	// If they never appear, they existed before our earliest patch (pre-7.06d).
	result := map[string]string{}

	rePatchHero := regexp.MustCompile(`DOTA_Patch_(\d+_\d+[a-z]*)_(\w+?)(?:_\d+)?["'\s]`)

	// Collect all patches per hero
	heroPatches := map[string][]string{}
	for _, m := range rePatchHero.FindAllStringSubmatch(content, -1) {
		patchVer := strings.Replace(m[1], "_", ".", 1)
		heroName := m[2]

		// Strip trailing numeric suffixes that are part of _2, _3 etc
		heroName = regexp.MustCompile(`_\d+$`).ReplaceAllString(heroName, "")

		if _, ok := heroByName[heroName]; ok {
			heroPatches[heroName] = append(heroPatches[heroName], patchVer)
		}
	}

	// For each hero, find the earliest patch
	for heroName, patches := range heroPatches {
		sort.Slice(patches, func(i, j int) bool {
			return comparePatchVersions(patches[i], patches[j])
		})
		earliest := patches[0]

		// The hero was INTRODUCED in or before this patch.
		// If their first mention is in the balance changes (not 7.06d which is our first),
		// they were likely added in the major patch (e.g., first seen at 7.07b means added at 7.07)
		majorPatch := extractMajorPatch(earliest)
		result[heroName] = majorPatch
	}

	return result
}

func extractMajorPatch(patch string) string {
	// 7.07b -> 7.07, 7.20c -> 7.20, 7.33 -> 7.33
	parts := strings.SplitN(patch, ".", 2)
	if len(parts) < 2 {
		return patch
	}
	rest := parts[1]
	i := 0
	for i < len(rest) && rest[i] >= '0' && rest[i] <= '9' {
		i++
	}
	return parts[0] + "." + rest[:i]
}

// filterSpeedsByPatch returns only the heroes that existed at the given patch
func filterSpeedsByPatch(allSpeeds map[string]int, heroAddedPatch map[string]string, currentPatch string) map[string]int {
	filtered := make(map[string]int, len(allSpeeds))
	for hero, speed := range allSpeeds {
		addedPatch := heroAddedPatch[hero]
		if addedPatch == "" {
			// Hero existed before our tracking — always include
			filtered[hero] = speed
			continue
		}
		// Include hero only if currentPatch >= addedPatch
		if !comparePatchVersions(currentPatch, addedPatch) {
			// currentPatch >= addedPatch (not strictly before)
			filtered[hero] = speed
		}
	}
	return filtered
}
