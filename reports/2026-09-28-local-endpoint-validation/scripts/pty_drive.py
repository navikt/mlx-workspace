#!/usr/bin/env python3
"""Run a command in a pty and answer its huh prompts.

  pty_drive.py <transcript> <timeout_s> 'regex=keys' ... -- cmd args...

Each regex is looked for in the output since the last answer; when it shows up, keys are
sent (after a short pause, so huh has the terminal in raw mode). Keys: y, n, enter, down.
Each answer fires once. Exit status is the command's, or 124 on timeout.
"""
import os
import fcntl
import pty
import struct
import termios
import re
import select
import sys
import time

KEYS = {"y": b"y", "n": b"n", "enter": b"\r", "down": b"\x1b[B"}
ANSI = re.compile(rb"\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][A-Z0-9]|\r")


def main():
    out, timeout = sys.argv[1], float(sys.argv[2])
    i = sys.argv.index("--")
    rules = [(re.compile(r.split("=", 1)[0]), r.split("=", 1)[1]) for r in sys.argv[3:i]]
    cmd = sys.argv[i + 1:]
    pid, fd = pty.fork()
    if pid == 0:
        os.environ["TERM"] = "xterm-256color"
        os.execvp(cmd[0], cmd)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
    raw, since, t0, fired = bytearray(), bytearray(), time.time(), []
    while time.time() - t0 < timeout:
        r, _, _ = select.select([fd], [], [], 0.5)
        if r:
            try:
                chunk = os.read(fd, 65536)
            except OSError:
                break
            if not chunk:
                break
            raw += chunk
            since += chunk
            # Answer the terminal queries a real terminal answers, or huh waits on them.
            for _ in range(chunk.count(b"\x1b]11;?")):
                os.write(fd, b"\x1b]11;rgb:0000/0000/0000\x1b\\")
            for _ in range(chunk.count(b"\x1b[6n")):
                os.write(fd, b"\x1b[1;1R")
        text = ANSI.sub(b"", bytes(since)).decode(errors="replace")
        for n, (rx, keys) in enumerate(rules):
            if n not in fired and rx.search(text):
                time.sleep(1.0)
                for k in keys.split(","):
                    os.write(fd, KEYS[k]); time.sleep(0.3)
                fired.append(n)
                raw += f"\n[pty_drive: saw /{rx.pattern}/, sent {keys}]\n".encode()
                since.clear()
                break
        done, status = os.waitpid(pid, os.WNOHANG)
        if done:
            break
    else:
        os.kill(pid, 9)
        status = None
    if status is None or not os.WIFEXITED(status):
        try:
            _, status = os.waitpid(pid, 0)
        except ChildProcessError:
            pass
    # Drain what is left.
    try:
        while True:
            r, _, _ = select.select([fd], [], [], 0.2)
            if not r:
                break
            chunk = os.read(fd, 65536)
            if not chunk:
                break
            raw += chunk
    except OSError:
        pass
    open(out + ".raw", "wb").write(bytes(raw))
    clean = ANSI.sub(b"", bytes(raw)).decode(errors="replace")
    code = os.waitstatus_to_exitcode(status) if status is not None else 124
    open(out, "w").write(clean + f"\n[pty_drive: exit {code}, {time.time() - t0:.0f} s]\n")
    sys.exit(code if code >= 0 else 124)


if __name__ == "__main__":
    main()
