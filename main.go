package main

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"strings"
)

func main() {
	f, err := os.Open("data/pak01_dir.vpk")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to open vpk: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	f.Seek(28, io.SeekStart)

	reader := bufio.NewReader(f)
	buf := make([]byte, 18)

	// Search for hero images, icons, portraits
	for {
		ext, err := reader.ReadBytes(0)
		if err != nil || len(ext) == 1 {
			break
		}
		extStr := string(ext[:len(ext)-1])

		for {
			path, err := reader.ReadBytes(0)
			if err != nil || len(path) == 1 {
				break
			}
			pathStr := string(path[:len(path)-1])

			for {
				file, err := reader.ReadBytes(0)
				if err != nil || len(file) == 1 {
					break
				}
				fileStr := string(file[:len(file)-1])

				if _, err := io.ReadFull(reader, buf); err != nil {
					return
				}

				preloadBytes := binary.LittleEndian.Uint16(buf[4:6])
				if preloadBytes > 0 {
					io.CopyN(io.Discard, reader, int64(preloadBytes))
				}

				fullName := pathStr + "/" + fileStr + "." + extStr
				size := binary.LittleEndian.Uint32(buf[12:16])

				// Hero icons and portraits
				if strings.Contains(fullName, "panorama/images/heroes/") && !strings.Contains(fullName, "selection") {
					fmt.Printf("%-10d  %s\n", size, fullName)
				}
			}
		}
	}
}
