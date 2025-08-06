import sys
print("Hello from Python!", file=sys.stdout)
print("This is stderr", file=sys.stderr)
sys.stdout.flush()
sys.stderr.flush()