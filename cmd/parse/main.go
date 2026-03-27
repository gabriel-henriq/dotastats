package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Hero struct {
	Name                 string  `json:"name"`
	Key                  string  `json:"key"`
	HeroID               int     `json:"heroId"`
	MovementSpeed        int     `json:"movementSpeed"`
	AttackAnimationPoint float64 `json:"attackAnimationPoint"`
	ArmorPhysical        float64 `json:"armorPhysical"`
	AttackRange          int     `json:"attackRange"`
	AttackRate           float64 `json:"attackRate"`
	MovementTurnRate     float64 `json:"movementTurnRate"`
	ProjectileSpeed      int     `json:"projectileSpeed"`
	Icon                 string  `json:"icon"`
}

func main() {
	data, err := os.ReadFile("data/npc_heroes.txt")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to read: %v\n", err)
		os.Exit(1)
	}

	content := strings.ReplaceAll(string(data), "\r", "")
	heroes := parseHeroes(content)

	out, _ := json.MarshalIndent(heroes, "", "  ")
	os.WriteFile("data/heroes.json", out, 0644)
	fmt.Printf("Parsed %d heroes\n", len(heroes))
}

func stripComments(line string) string {
	// Remove inline comments (but not inside quotes)
	inQuote := false
	for i, c := range line {
		if c == '"' {
			inQuote = !inQuote
		}
		if !inQuote && c == '/' && i+1 < len(line) && line[i+1] == '/' {
			return line[:i]
		}
	}
	return line
}

func parseHeroes(content string) []Hero {
	var heroes []Hero
	lines := strings.Split(content, "\n")

	// Tokenize: extract a flat stream of tokens (strings and braces)
	var tokens []string
	for _, line := range lines {
		line = stripComments(line)
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// Handle { and } mixed with content
		for _, c := range line {
			if c == '{' {
				tokens = append(tokens, "{")
			} else if c == '}' {
				tokens = append(tokens, "}")
			}
		}
		// Also extract quoted strings
		rest := line
		for {
			start := strings.Index(rest, "\"")
			if start < 0 {
				break
			}
			rest = rest[start+1:]
			end := strings.Index(rest, "\"")
			if end < 0 {
				break
			}
			tokens = append(tokens, rest[:end])
			rest = rest[end+1:]
		}
	}

	// Now parse token stream
	// Find DOTAHeroes block
	ti := 0
	for ti < len(tokens) && tokens[ti] != "DOTAHeroes" {
		ti++
	}
	ti++ // skip DOTAHeroes
	for ti < len(tokens) && tokens[ti] != "{" {
		ti++
	}
	ti++ // skip {

	// Parse hero entries at this level
	for ti < len(tokens) {
		if tokens[ti] == "}" {
			break // end of DOTAHeroes
		}

		if tokens[ti] == "{" {
			// skip unexpected block
			ti++
			skipBlock(tokens, &ti)
			continue
		}

		key := tokens[ti]
		ti++

		if ti >= len(tokens) {
			break
		}

		if tokens[ti] == "{" {
			// This is a block
			ti++ // skip {
			props := parseBlock(tokens, &ti)

			if !strings.HasPrefix(key, "npc_dota_hero_") {
				continue
			}
			if key == "npc_dota_hero_base" || key == "npc_dota_hero_target_dummy" {
				continue
			}
			if props["Enabled"] != "1" {
				continue
			}

			heroID, _ := strconv.Atoi(props["HeroID"])
			if heroID == 0 {
				continue
			}

			moveSpeed, _ := strconv.Atoi(props["MovementSpeed"])
			if moveSpeed == 0 {
				moveSpeed = 300
			}

			aap, _ := strconv.ParseFloat(props["AttackAnimationPoint"], 64)
			if aap == 0 {
				aap = 0.75
			}

			armor, _ := strconv.ParseFloat(props["ArmorPhysical"], 64)
			// base default is -1 from npc_dota_hero_base
			if _, ok := props["ArmorPhysical"]; !ok {
				armor = -1
			}

			attackRange, _ := strconv.Atoi(props["AttackRange"])
			if attackRange == 0 {
				attackRange = 600
			}

			attackRate, _ := strconv.ParseFloat(props["AttackRate"], 64)
			if attackRate == 0 {
				attackRate = 1.7
			}

			turnRate, _ := strconv.ParseFloat(props["MovementTurnRate"], 64)
			if turnRate == 0 {
				turnRate = 0.6
			}

			projectileSpeed, _ := strconv.Atoi(props["ProjectileSpeed"])

			shortKey := strings.TrimPrefix(key, "npc_dota_hero_")

			heroes = append(heroes, Hero{
				Name:                 shortKey,
				Key:                  key,
				HeroID:               heroID,
				MovementSpeed:        moveSpeed,
				AttackAnimationPoint: aap,
				ArmorPhysical:        armor,
				AttackRange:          attackRange,
				AttackRate:           attackRate,
				MovementTurnRate:     turnRate,
				ProjectileSpeed:      projectileSpeed,
				Icon:                 key + "_png.png",
			})
		} else {
			// key-value pair, skip value
			ti++
		}
	}

	return heroes
}

// parseBlock reads top-level key-value pairs from a block, skipping nested blocks.
// ti should point to the first token after the opening {.
// Returns when the matching } is found.
func parseBlock(tokens []string, ti *int) map[string]string {
	props := make(map[string]string)
	for *ti < len(tokens) {
		if tokens[*ti] == "}" {
			*ti++
			return props
		}
		if tokens[*ti] == "{" {
			*ti++
			skipBlock(tokens, ti)
			continue
		}

		key := tokens[*ti]
		*ti++
		if *ti >= len(tokens) {
			break
		}
		if tokens[*ti] == "{" {
			// nested block, skip it
			*ti++
			skipBlock(tokens, ti)
		} else if tokens[*ti] != "}" {
			props[key] = tokens[*ti]
			*ti++
		}
	}
	return props
}

func skipBlock(tokens []string, ti *int) {
	depth := 1
	for *ti < len(tokens) && depth > 0 {
		if tokens[*ti] == "{" {
			depth++
		} else if tokens[*ti] == "}" {
			depth--
		}
		*ti++
	}
}
