package lib

import (
	"bufio"
	"bytes"
	// "errors"
	// "log"
	"io"
	// "os"
	"os/exec"
	// "syscall"
)

// Callback -
type Callback func(line string)

// StderrWriter -
type StderrWriter func(format string, a ...interface{})

// Streamer -
type Streamer struct {
	buf    *bytes.Buffer
	writer StderrWriter
	prefix string
}

// NewStreamer -
func NewStreamer(writer StderrWriter, prefix string) *Streamer {
	return &Streamer{
		buf:    bytes.NewBuffer([]byte("")),
		writer: writer,
		prefix: prefix,
	}
}

func (s *Streamer) Write(p []byte) (n int, err error) {
	if n, err = s.buf.Write(p); err != nil {
		return
	}

	var line string
	for {
		line, err = s.buf.ReadString('\n')
		if err == io.EOF {
			break
		}
		if err != nil {
			return
		}

		// l.readLines += line
		s.writer("%s: %s", s.prefix, line)
	}

	return
}

// ShellEx -
func ShellEx(writer StderrWriter, prefix, workDir string, callback Callback, name string, args ...string) error {
	return shell(writer, prefix, workDir, callback, name, args...)
}

// Shell -
func Shell(command string, writer StderrWriter, prefix, workDir string, callback Callback) error {
	args := []string{
		"-c",
	}
	args = append(args, command)

	return shell(writer, prefix, workDir, callback, "/bin/sh", args...)
}

// writer: mlog.Writer
// prefix: prefix for each log line
// callback: invoked on each output line
// name: command name
// args: command arguments
func shell(writer StderrWriter, prefix, workDir string, callback Callback, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	// cmd.Env = os.Environ()
	if workDir != "" {
		cmd.Dir = workDir
	}
	cmd.Stderr = NewStreamer(writer, prefix)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
		//		log.Fatalf("Unable to stdoutpipe %s: %s", command, err)
	}
	scanner := bufio.NewScanner(stdout)

	if err = cmd.Start(); err != nil {
		return err
		// log.Fatal("Unable to start command: ", err)
	}

	for scanner.Scan() {
		callback(scanner.Text())
	}

	// Wait for the result of the command; also closes our end of the pipe
	err = cmd.Wait()
	if err != nil {
		writer("%s: waitError: %s", prefix, err)
		return err
		// log.Fatal("Unable to wait for process to finish: ", err)
	}

	return nil
}