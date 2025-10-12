# CI/CD Setup

This document explains how to set up the continuous integration and continuous deployment (CI/CD) pipeline for this project.

## GitHub Actions

The project uses GitHub Actions for automated testing, building, and deployment. Two main workflows are configured:

- `ci.yml`: Runs tests and checks on every pull request
- `cd.yml`: Handles deployment when code is merged to main

## Required Secrets

Before the CI/CD pipelines can work, you need to set up the following secrets in your GitHub repository:

### Docker Hub Secrets
| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username | Your Docker Hub account username |
| `DOCKERHUB_TOKEN` | Access token for Docker Hub | Generate from Docker Hub security settings |

For detailed instructions on setting up secrets, see [SECRETS_SETUP.md](./SECRETS_SETUP.md).

## Workflows

### Continuous Integration (ci.yml)
- Runs on push to main and pull requests
- Performs:
  - Dependency installation
  - Linting
  - Building
  - Testing
  - Cache management

### Continuous Deployment (cd.yml)
- Runs on push to main
- Performs:
  - Docker image building
  - Docker image pushing
  - Deployment (if configured)

## Setting Up CI/CD

1. Fork/clone the repository
2. Set up required secrets (see above)
3. Enable GitHub Actions in your repository
4. Push to trigger the workflows

## Monitoring

- Check the "Actions" tab in GitHub to monitor workflow runs
- Review workflow logs for any issues
- Set up notifications for workflow failures

## Customizing

To customize the CI/CD pipeline:

1. Edit workflows in `.github/workflows/`
2. Test changes in a branch
3. Update documentation
4. Create a pull request

## Troubleshooting

Common issues and solutions:

1. **Workflow Failures**
   - Check secrets are properly set
   - Verify Docker Hub credentials
   - Review action logs for errors

2. **Docker Issues**
   - Confirm Docker Hub access
   - Check image build steps
   - Verify registry permissions

3. **Deployment Problems**
   - Review deployment credentials
   - Check environment variables
   - Verify hosting platform status