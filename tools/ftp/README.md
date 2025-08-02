# FTP Upload Tool

This tool uploads gzip files to an FTP server for hosting large data files.

## Setup

1. Copy the configuration template:
   ```bash
   cp ftp.yml.example ftp.yml
   ```

2. Edit `ftp.yml` with your FTP server details:
   ```yaml
   host: your.ftp.server.com
   port: 21
   username: your_username
   password: your_password
   destinations:
     - site:
       sitename: ja-googology-wiki
       dir: /public_html/your.site.com/googolbook-lm/data/ja-googology-wiki
     - site:
       sitename: googology-wiki
       dir: /public_html/your.site.com/googolbook-lm/data/googology-wiki
   ```

3. Make sure `ftp.yml` is in `.gitignore` to avoid committing credentials (already added).

## Usage

### Upload All Sites

Upload all .gz files for all sites defined in configuration:
```bash
python upload.py
```

### Upload Specific Site

Upload all .gz files for a specific site:
```bash
python upload.py ja-googology-wiki
```

## Examples

### Upload Site Files
```bash
# Upload all sites (Japanese and English)
python upload.py

# Upload Japanese Googology Wiki files only
python upload.py ja-googology-wiki

# Upload English Googology Wiki files only
python upload.py googology-wiki

# Use custom configuration file for all sites
python upload.py --config my_ftp_config.yml

# Use custom configuration file for specific site
python upload.py ja-googology-wiki --config my_ftp_config.yml
```

## Features

- Automatic remote directory creation
- Progress display with file sizes
- Dry run mode for testing
- Pattern matching for selective uploads
- Error handling and recovery
- Support for large files

## Requirements

- Python 3.6+
- PyYAML (`pip install pyyaml`)

## Security Notes

- Never commit `ftp.yml` with actual credentials
- Consider using environment variables for sensitive data in production
- Use FTPS/SFTP if available for encrypted transfers