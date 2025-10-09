# Setting Up GitHub Actions Secrets

This guide explains how to set up the required secrets for the CI/CD pipelines.

## Required Secrets

For the current CI/CD setup, you need to configure these secrets:

1. `DOCKERHUB_USERNAME`: Your Docker Hub username
2. `DOCKERHUB_TOKEN`: Your Docker Hub access token

## How to Add Secrets

1. Go to your GitHub repository: `https://github.com/Happyesss/Fairlx`
2. Click on "Settings" tab
3. In the left sidebar, click on "Secrets and variables" → "Actions"
4. Click on "New repository secret"
5. Add each secret individually:

### Setting up Docker Hub Secrets

#### DOCKERHUB_USERNAME
1. Add new secret with name `DOCKERHUB_USERNAME`
2. Value: Your Docker Hub username
3. Click "Add secret"

#### DOCKERHUB_TOKEN
1. First, get your Docker Hub token:
   - Log in to [Docker Hub](https://hub.docker.com)
   - Click on your username → Account Settings
   - Select "Security" in the left sidebar
   - Click "New Access Token"
   - Give it a name (e.g., "GitHub Actions")
   - Copy the generated token immediately
2. Add new secret with name `DOCKERHUB_TOKEN`
3. Value: Paste your Docker Hub token
4. Click "Add secret"

## Verifying Secrets

After adding secrets:
1. Go to the "Actions" tab in your repository
2. Check if any workflows are failing due to missing secrets
3. Secrets will appear as `***` in the logs for security

## Using Secrets in Workflows

Secrets are already configured in the workflows:

```yaml
# Example from cd.yml
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

## Security Best Practices

1. Never commit secrets directly in the code
2. Rotate access tokens periodically
3. Use tokens with minimal required permissions
4. Audit secret usage regularly in Actions logs

## Troubleshooting

If you encounter errors:

1. Verify secret names match exactly (case-sensitive)
2. Check if secrets are properly configured in repository settings
3. Ensure Docker Hub token has proper permissions
4. Review Actions logs for specific error messages

For additional help:
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Docker Hub Access Tokens](https://docs.docker.com/docker-hub/access-tokens/)