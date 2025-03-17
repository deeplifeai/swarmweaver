import os
import json
import argparse

def repo_to_json(repo_path, output_file):
    """Convert repository structure to JSON with file contents"""
    excluded_dirs = {'.git', 'node_modules', 'dist', 'build', '__pycache__'}
    excluded_files = {'.DS_Store', '*.log', '*.lock'}
    excluded_extensions = {'.js', '.js.map', '.d.ts', '.exe', '.pyc'}

    repo_structure = {}

    for root, dirs, files in os.walk(repo_path):
        # Filter directories
        dirs[:] = [d for d in dirs if d not in excluded_dirs]
        
        current_level = repo_structure
        # Get relative path from repo root
        rel_path = os.path.relpath(root, repo_path)
        if rel_path != '.':
            for part in rel_path.split(os.sep):
                current_level = current_level.setdefault(part, {})

        for file in files:
            if (any(file.endswith(ext) for ext in excluded_extensions) or
                file in excluded_files):
                continue

            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except UnicodeDecodeError:
                continue  # Skip binary files

            current_level[file] = content

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(repo_structure, f, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert repository to JSON")
    parser.add_argument("repo_path", help="Path to repository")
    parser.add_argument("output_file", help="Output JSON file name")
    args = parser.parse_args()

    repo_to_json(args.repo_path, args.output_file)
    print(f"Repository JSON created at {args.output_file}")
