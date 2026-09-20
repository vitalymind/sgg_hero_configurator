import os
import sys
import stat

def main():
		root_dir = os.path.dirname(os.path.abspath(__file__))
		hooks_dir = os.path.join(root_dir, '.git', 'hooks')

		if not os.path.exists(hooks_dir):
				print("❌ Error: .git/hooks directory not found. Is this a git repository?")
				sys.exit(1)

		hook_path = os.path.join(hooks_dir, 'pre-commit')

		# Git hooks always run via a POSIX shell script, even on Windows
		hook_content = (
				"#!/bin/sh\n"
				"# Auto-generated hook by install_git_hooks.py\n"
				"PYTHONIOENCODING=utf-8 python run_pre_commit.py\n"
		)

		with open(hook_path, 'w', encoding='utf-8', newline='\n') as f:
				f.write(hook_content)

		# Ensure file has execute permissions
		try:
				os.chmod(hook_path, os.stat(hook_path).st_mode | stat.S_IEXEC)
		except Exception:
				pass

		print(f"✅ Git pre-commit hook installed successfully at:\n   {hook_path}")

if __name__ == '__main__':
		main()