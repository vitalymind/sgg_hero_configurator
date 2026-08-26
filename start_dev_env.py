import os
import subprocess
import sys

def pause_and_exit(exit_code=1):
    try:
        input("\nPress Enter to exit...")
    except (KeyboardInterrupt, EOFError):
        pass
    sys.exit(exit_code)

def is_docker_running():
    try:
        result = subprocess.run(
            'docker info',
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return result.returncode == 0
    except Exception:
        return False

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    server_dir = os.path.join(root_dir, 'server')
    client_dir = os.path.join(root_dir, 'client')

    print("🔍 Checking Docker status...")
    if not is_docker_running():
        print("\n❌ Error: Docker is not running or not installed!")
        print("👉 Please start Docker Desktop (or the Docker daemon) and try again.")
        pause_and_exit(1)

    try:
        print("📦 Installing/Updating server dependencies...")
        subprocess.run('npm install', cwd=server_dir, shell=True, check=True)

        print("📦 Installing/Updating client dependencies...")
        subprocess.run('npm install', cwd=client_dir, shell=True, check=True)

        print("🏗️  Building and Starting Server container (this may take a moment)...")
        if not os.path.exists(os.path.join(server_dir, '.env')):
            open(os.path.join(server_dir, '.env'), 'a').close()
        subprocess.run('npm run dev_server', cwd=server_dir, shell=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Command failed with error code {e.returncode}: {e.cmd}")
        pause_and_exit(1)
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        pause_and_exit(1)

    print("🚀 Starting Vite Client...")
    client_process = subprocess.Popen('npm run dev', cwd=client_dir, shell=True)

    try:
        # Keep the script running to stream the Vite logs
        client_process.wait()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down dev environment...")
        client_process.terminate()
        print("🛑 Stopping Server container...")
        subprocess.run('docker compose down', cwd=server_dir, shell=True)
        sys.exit(0)

if __name__ == '__main__':
    main()

