import os
import subprocess
import sys
import time

# Force UTF-8 encoding for Windows Git subshells
if hasattr(sys.stdout, 'reconfigure'):
		sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
		sys.stderr.reconfigure(encoding='utf-8', errors='replace')
  
def run_step(step_number, total_steps, title, command, cwd):
		print(f"\n[{step_number}/{total_steps}] ⏳ {title}...")
		start = time.time()
		try:
				subprocess.run(command, cwd=cwd, shell=True, check=True)
				elapsed = time.time() - start
				print(f"[{step_number}/{total_steps}] ✅ {title} passed ({elapsed:.1f}s)")
				return True
		except subprocess.CalledProcessError as e:
				elapsed = time.time() - start
				print(f"\n❌ Error: '{title}' failed after {elapsed:.1f}s (exit code {e.returncode})")
				return False

def main():
		root_dir = os.path.dirname(os.path.abspath(__file__))
		client_dir = os.path.join(root_dir, 'client')

		print("=" * 60)
		print("🛡️  Running Pre-Commit Verification Checks")
		print("=" * 60)

		steps = [
				("Building @hero_manager/shared", "npm run build:shared", root_dir),
				("Typechecking Client (TypeScript)", "npx tsc --noEmit -p client/tsconfig.json", root_dir),
				("Running Client Unit Tests (Vitest)", "npm run test:run", client_dir),
		]

		total_steps = len(steps)
		for idx, (title, command, cwd) in enumerate(steps, 1):
				success = run_step(idx, total_steps, title, command, cwd)
				if not success:
						print("\n❌ Pre-commit checks FAILED. Commit aborted.")
						sys.exit(1)

		print("\n" + "=" * 60)
		print("🎉 All pre-commit checks PASSED! Safe to commit.")
		print("=" * 60 + "\n")
		sys.exit(0)

if __name__ == '__main__':
		main()