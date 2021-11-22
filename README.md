# Detect Action

(WIP)

Execute Synopsys Detect against your source to easily import your code into Black Duck for dependency analysis.

Comments on Pull Requests if any of your dependencies violate policies.

```yaml
name: Example workflow
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - name: Set up JDK 11
        uses: actions/setup-java@v2
        with:
          java-version: '11'
          distribution: 'adopt'
      - name: Synopsys Detect
        uses: synopsys-sig/detect-action@main
        with:
            github-token: ${{ secrets.GITHUB_TOKEN }}
            blackduck-url: ${{ secrets.BLACKDUCK_URL }}
            blackduck-api-token: ${{ secrets.BLACKDUCK_API_TOKEN }}
```

### Troubleshooting
To include one or more certificates, set `NODE_EXTRA_CA_CERTS` to the certificate file-path(s) in the environment. The certificate(s) must be in _pem_ format. Be sure to escape whitespace properly based on your runner's OS.  
**Example**:   
```yaml
- name: Synopsys Detect
        uses: synopsys-sig/detect-action@main
        env:
            NODE_EXTRA_CA_CERTS: ${{ secrets.LOCAL_CA_CERT_PATH }}
        with:
            . . .
```