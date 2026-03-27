package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type Hero struct {
	Name                 string  `json:"name"`
	Key                  string  `json:"key"`
	HeroID               int     `json:"heroId"`
	MovementSpeed        int     `json:"movementSpeed"`
	AttackAnimationPoint float64 `json:"attackAnimationPoint"`
	Icon                 string  `json:"icon"`
	AddedPatch           string  `json:"addedPatch,omitempty"`
}

type PatchSnapshot struct {
	Patch   string             `json:"patch"`
	Values  map[string]float64 `json:"values"`
	Changes []PatchChange      `json:"changes,omitempty"`
}

type PatchChange struct {
	Hero string  `json:"hero"`
	From float64 `json:"from"`
	To   float64 `json:"to"`
}

type TimelineData struct {
	Stat      string          `json:"stat"`
	Label     string          `json:"label"`
	Heroes    []Hero          `json:"heroes"`
	Snapshots []PatchSnapshot `json:"snapshots"`
}

type statConfig struct {
	name       string
	label      string
	getValue   func(h Hero) float64
	reFromTo   *regexp.Regexp
	reByN      *regexp.Regexp
	patchFilter func(key, val string) bool
}

var rePatchKey = regexp.MustCompile(`^DOTA_Patch_(\d+_\d+[a-z]*)_(.+?)(?:_\d+)?$`)

var stats = []statConfig{
	{
		name:  "movespeed",
		label: "Movement Speed",
		getValue: func(h Hero) float64 { return float64(h.MovementSpeed) },
		reFromTo: regexp.MustCompile(`(?i)(?:base )?move?ment ?speed (?:increased|reduced|decreased|changed) from (\d+\.?\d*) to (\d+\.?\d*)`),
		reByN:    regexp.MustCompile(`(?i)(?:base )?move?ment ?speed (?:increased|reduced|decreased) by (\d+)`),
		patchFilter: func(key, val string) bool {
			lower := strings.ToLower(val)
			if strings.Contains(lower, "talent") || strings.Contains(lower, "level ") {
				return false
			}
			return strings.Contains(lower, "movement speed") || strings.Contains(lower, "movespeed")
		},
	},
	{
		name:  "aap",
		label: "Attack Animation Point",
		getValue: func(h Hero) float64 { return h.AttackAnimationPoint },
		reFromTo: regexp.MustCompile(`(?i)attack (?:animation(?:\s+time)?|point) (?:improved|reduced|increased|decreased|changed) from (\d+\.?\d*) to (\d+\.?\d*)`),
		reByN:    nil, // AAP changes are always from/to, never "by N"
		patchFilter: func(key, val string) bool {
			lower := strings.ToLower(val)
			if strings.Contains(lower, "talent") || strings.Contains(lower, "level ") {
				return false
			}
			if strings.Contains(lower, "backswing") {
				return false
			}
			return strings.Contains(lower, "attack point") || strings.Contains(lower, "attack animation")
		},
	},
}

// Hero intro patches
var heroIntroPatches = map[string]string{
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

func main() {
	heroData, _ := os.ReadFile("data/heroes.json")
	var heroes []Hero
	json.Unmarshal(heroData, &heroes)

	heroByName := map[string]*Hero{}
	for i := range heroes {
		heroByName[heroes[i].Name] = &heroes[i]
	}

	// Set intro patches
	for name, patch := range heroIntroPatches {
		if h, ok := heroByName[name]; ok {
			h.AddedPatch = patch
		}
	}

	patchData, _ := os.ReadFile("data/patchnotes_english.txt")
	content := strings.ReplaceAll(string(patchData), "\r", "")

	for _, stat := range stats {
		timeline := buildTimeline(stat, heroes, heroByName, content, patchData)
		out, _ := json.MarshalIndent(timeline, "", "  ")

		filename := fmt.Sprintf("timeline_%s.json", stat.name)
		os.WriteFile("data/"+filename, out, 0644)
		os.WriteFile("web/public/"+filename, out, 0644)

		fmt.Printf("[%s] %d snapshots, %d changes\n", stat.name, len(timeline.Snapshots), countChanges(timeline))
	}
}

func countChanges(t TimelineData) int {
	n := 0
	for _, s := range t.Snapshots {
		n += len(s.Changes)
	}
	return n
}

type msChange struct {
	patch    string
	hero     string
	newVal   float64
	delta    float64
	increase bool
}

func buildTimeline(stat statConfig, heroes []Hero, heroByName map[string]*Hero, content string, patchData []byte) TimelineData {
	var changes []msChange
	patchOrder := []string{}
	patchSeen := map[string]bool{}

	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "\"DOTA_Patch_") {
			continue
		}

		keyStr, valStr := extractKV(line)
		if keyStr == "" || valStr == "" {
			continue
		}

		if !stat.patchFilter(keyStr, valStr) {
			continue
		}

		m := rePatchKey.FindStringSubmatch(keyStr)
		if m == nil {
			continue
		}

		patchVer := strings.Replace(m[1], "_", ".", 1)
		heroName := m[2]

		if !patchSeen[patchVer] {
			patchSeen[patchVer] = true
			patchOrder = append(patchOrder, patchVer)
		}

		// Resolve hero name
		if _, ok := heroByName[heroName]; !ok {
			base := regexp.MustCompile(`_\d+$`).ReplaceAllString(heroName, "")
			if _, ok := heroByName[base]; !ok {
				if heroName == "General" {
					// Bulk changes
				} else {
					continue
				}
			} else {
				heroName = base
			}
		}

		if mft := stat.reFromTo.FindStringSubmatch(valStr); mft != nil {
			to, _ := strconv.ParseFloat(mft[2], 64)
			if heroName == "General" {
				continue
			}
			changes = append(changes, msChange{
				patch:  patchVer,
				hero:   heroName,
				newVal: to,
			})
		} else if stat.reByN != nil {
			if mbn := stat.reByN.FindStringSubmatch(valStr); mbn != nil {
				n, _ := strconv.ParseFloat(mbn[1], 64)
				increase := strings.Contains(strings.ToLower(valStr), "increased") || strings.Contains(strings.ToLower(valStr), "improved")
				if !increase {
					n = -n
				}
				if heroName == "General" {
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
	}

	sort.Slice(patchOrder, func(i, j int) bool {
		return comparePatchVersions(patchOrder[i], patchOrder[j])
	})

	patchChanges := map[string][]msChange{}
	for _, c := range changes {
		patchChanges[c.patch] = append(patchChanges[c.patch], c)
	}

	heroAddedPatch := map[string]string{}
	for _, h := range heroes {
		heroAddedPatch[h.Name] = h.AddedPatch
	}

	currentValues := map[string]float64{}
	for _, h := range heroes {
		currentValues[h.Name] = stat.getValue(h)
	}

	type patchResult struct {
		patch   string
		changes []PatchChange
	}

	var results []patchResult
	values := copyMapF(currentValues)

	for i := len(patchOrder) - 1; i >= 0; i-- {
		patch := patchOrder[i]
		pChanges := patchChanges[patch]

		var snapshotChanges []PatchChange

		for _, c := range pChanges {
			if c.hero == "_general" {
				for name := range values {
					values[name] -= c.delta
				}
				continue
			}

			if _, ok := values[c.hero]; !ok {
				continue
			}

			afterVal := values[c.hero]
			if c.newVal > 0 {
				from := findFromValue(stat, patchData, patch, c.hero, c.newVal)
				values[c.hero] = from
				if !floatEq(from, afterVal) {
					snapshotChanges = append(snapshotChanges, PatchChange{
						Hero: c.hero,
						From: from,
						To:   afterVal,
					})
				}
			} else if c.delta != 0 {
				values[c.hero] -= c.delta
				if !floatEq(values[c.hero], afterVal) {
					snapshotChanges = append(snapshotChanges, PatchChange{
						Hero: c.hero,
						From: values[c.hero],
						To:   afterVal,
					})
				}
			}
		}

		results = append(results, patchResult{
			patch:   patch,
			changes: snapshotChanges,
		})
	}

	// Reverse
	for i, j := 0, len(results)-1; i < j; i, j = i+1, j-1 {
		results[i], results[j] = results[j], results[i]
	}

	// Build forward
	snapshots := []PatchSnapshot{}
	fwdValues := copyMapF(values)

	for _, r := range results {
		for _, c := range r.changes {
			fwdValues[c.Hero] = c.To
		}

		snapshots = append(snapshots, PatchSnapshot{
			Patch:   r.patch,
			Values:  filterValuesByPatch(fwdValues, heroAddedPatch, r.patch),
			Changes: r.changes,
		})

		fwdValues = copyMapF(fwdValues)
	}

	return TimelineData{
		Stat:      stat.name,
		Label:     stat.label,
		Heroes:    heroes,
		Snapshots: snapshots,
	}
}

func extractKV(line string) (string, string) {
	line = strings.TrimSpace(line)
	if !strings.HasPrefix(line, "\"") {
		return "", ""
	}
	end := strings.Index(line[1:], "\"")
	if end < 0 {
		return "", ""
	}
	key := line[1 : end+1]
	rest := line[end+2:]
	start := strings.Index(rest, "\"")
	if start < 0 {
		return key, ""
	}
	rest = rest[start+1:]
	vEnd := strings.LastIndex(rest, "\"")
	if vEnd < 0 {
		return key, ""
	}
	return key, rest[:vEnd]
}

func findFromValue(stat statConfig, patchData []byte, patch, hero string, toVal float64) float64 {
	content := string(patchData)
	patchKey := "DOTA_Patch_" + strings.Replace(patch, ".", "_", 1) + "_" + hero

	idx := strings.Index(content, patchKey)
	if idx < 0 {
		for suffix := 2; suffix <= 5; suffix++ {
			idx = strings.Index(content, fmt.Sprintf("%s_%d", patchKey, suffix))
			if idx >= 0 {
				break
			}
		}
	}

	if idx >= 0 {
		lineEnd := strings.Index(content[idx:], "\n")
		if lineEnd > 0 {
			line := content[idx : idx+lineEnd]
			m := stat.reFromTo.FindStringSubmatch(line)
			if m != nil {
				from, _ := strconv.ParseFloat(m[1], 64)
				return from
			}
		}
	}

	return toVal
}

func floatEq(a, b float64) bool {
	return math.Abs(a-b) < 0.001
}

func copyMapF(m map[string]float64) map[string]float64 {
	c := make(map[string]float64, len(m))
	for k, v := range m {
		c[k] = v
	}
	return c
}

func filterValuesByPatch(allValues map[string]float64, heroAddedPatch map[string]string, currentPatch string) map[string]float64 {
	filtered := make(map[string]float64, len(allValues))
	for hero, val := range allValues {
		addedPatch := heroAddedPatch[hero]
		if addedPatch == "" || !comparePatchVersions(currentPatch, addedPatch) {
			filtered[hero] = val
		}
	}
	return filtered
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
	parts := strings.SplitN(v, ".", 2)
	major := parts[0]
	minor := ""
	suffix := ""
	if len(parts) > 1 {
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
