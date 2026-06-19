import os
import subprocess
import sys

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    server_dir = os.path.join(root_dir, 'server')
    client_dir = os.path.join(root_dir, 'client')

    print("📦 Installing/Updating server dependencies...")
    subprocess.run('npm install', cwd=server_dir, shell=True, check=True)

    print("📦 Installing/Updating client dependencies...")
    subprocess.run('npm install', cwd=client_dir, shell=True, check=True)

    print("🏗️  Building and Starting Server container (this may take a moment)...")
    if not os.path.exists(os.path.join(server_dir, '.env')): open(os.path.join(server_dir, '.env'), 'a').close()
    subprocess.run('npm run dev_server', cwd=server_dir, shell=True, check=True)

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
