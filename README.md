# Detect Action

(WIP)

Execute Synopsys Detect against your source to easily import your code into Black Duck for dependency analysis.

Comments on Pull Requests if any of your dependencies violate policies.

# Table Of Contents
- [Setup Workflow](#setup-workflow)
- [Setup Job](#setup-job)
  - [Runners: Self Hosted](#runners-self-hosted)
  - [Runners: GitHub Hosted](#runners-github-hosted)
  - [Checkout](#checkout)
  - [Build Your Project](#build-your-project)
  - [Setup Java](#setup-java)
  - [Create Black Duck Policy (Optional)](#create-black-duck-policy-optional)
  - [Setup Detect Action](#setup-detect-action)
  - [Include Custom Certificates (Optional)](#include-custom-certificates-optional)

# Setup Workflow
To start using this action, you'll need to create a _job_ within a GitHub Workflow. You can either [create a new GitHub Workflow](https://docs.github.com/en/actions/learn-github-actions/workflow-syntax-for-github-actions) or use an existing one if appropriate for your use-case. 

Once you have a GitHub Workflow selected, configure which [events will trigger the workflow](https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows) such as _pull requests_ or _schedules_.  
**Example**
```yaml
name: Example Workflow
on:
  pull_request:
    branches:
      - main
  schedule:
    - cron:  '0 0 * * *'
```

# Setup Job
Once you have setup a GitHub Workflow with event triggers, you will need to create a _job_ in which the _Detect Action_ will run.  
Your job will look something like this if all configuration options are used:  
```yaml
jobs:
  security:
    runs-on: my-github-runner
    steps:
    - uses: actions/checkout@v2
    - name: Set up JDK 11
      uses: actions/setup-java@v2
      with:
        java-version: '11'
        distribution: 'adopt'
    # Because this example is building a Gradle project, it needs to happen after setting up Java
    - name: Grant execute permission for gradlew to build my project
      run: chmod +x gradlew
    - name: Build my project with Gradle
      run: ./gradlew build
    - name: Create Black Duck Policy
      env:
        NODE_EXTRA_CA_CERTS: ${{ secrets.LOCAL_CA_CERT_PATH }}
      uses: blackducksoftware/create-policy-action@v0.0.1
      with:
        blackduck-url: ${{ secrets.BLACKDUCK_URL }}
        blackduck-api-token: ${{ secrets.BLACKDUCK_API_TOKEN }}
        policy-name: 'My Black Duck Policy For GitHub Actions'
        no-fail-if-policy-exists: true
    - name: Run Synopsys Detect
      uses: synopsys-sig/detect-action@v0.0.1
      env:
        NODE_EXTRA_CA_CERTS: ${{ secrets.LOCAL_CA_CERT_PATH }}
      with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          detect-version: 7.7.0
          blackduck-url: ${{ secrets.BLACKDUCK_URL }}
          blackduck-api-token: ${{ secrets.BLACKDUCK_API_TOKEN }}
```

## Runners: Self Hosted
TODO

## Runners: GitHub Hosted
TODO

## Checkout
Checkout the source-code onto your GitHub Runner with the following _step_:  
```yaml
    - uses: actions/checkout@v2
```

## Build Your Project
Detect is meant to be run post-build. You should add steps necessary to build your project before invoking the _Detect Action_. For example, here is how this might be done in a Gradle project:  
```yaml
    - name: Grant execute permission for gradlew
      run: chmod +x gradlew
    - name: Build with Gradle
      run: ./gradlew build
```
In the example job above, this needed to be done _after_ setting up Java because Gradle requires Java. If your project does not use Java, this step can be done before setting up Java.

## Setup Java
Detect runs using Java 11 and the prefered distribution is from [AdoptOpenJDK](https://github.com/AdoptOpenJDK). Configure the _step_ it as follows: 
```yaml
    - name: Set up JDK 11
      uses: actions/setup-java@v2
      with:
        java-version: '11'
        distribution: 'adopt'
```

## Create Black Duck Policy (Optional)
In order to run Detect using RAPID mode (which is the default mode for the _Detect Action_), the Black Duck server Detect connects to must have at least one _policy_ and that policy must be enabled. You can create a policy within your Black Duck instance, or you can create a policy directly from your workflow using Black Duck's [_Create Policy Action_](https://github.com/blackducksoftware/create-policy-action). Note: The _Create Policy Action_ is provided for convenience and not the preferred way to manage Black Duck policies.  

The most basic usage of the action looks like this: 
```yaml
    - name: Create Black Duck Policy
      uses: blackducksoftware/create-policy-action@v0.0.1
      with:
        blackduck-url: ${{ secrets.BLACKDUCK_URL }}
        blackduck-api-token: ${{ secrets.BLACKDUCK_API_TOKEN }}
```
Please refer to [that action's documentation](https://github.com/blackducksoftware/create-policy-action) for more information on available parameters, certificate management, and troubleshooting.

## Setup Detect Action
Once your project is checked-out, built, and Java is configured, the _Detect Action_ can finally be run. At minimum for Detect to run, the Black Duck URL (`blackduck-url`), API Token (`blackduck-api-token`), and Detect Version (`detect-version`) must be provided as parameters. Additionally, a _GITHUB\_TOKEN_ (`github-token`) is required in order to comment on Pull Requests or hook into GitHub Checks.

### Optional Parameters
 - `scan-mode`: Either RAPID or INTELLIGENT, configures how Detect is invoked. RAPID will not persist the results and disables select Detect functionality for faster results. INTELLIGENT persists the results and permits all features of Detect.
   - Default: RAPID
 - `output-path-override`: Override for where to output Detect files
   - Default: $RUNNER_TEMP/blackduck/

```yaml
    - name: Synopsys Detect
      uses: synopsys-sig/detect-action@main
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
        detect-version: 7.7.0
        blackduck-url: ${{ secrets.BLACKDUCK_URL }}
        blackduck-api-token: ${{ secrets.BLACKDUCK_API_TOKEN }}
```

## Include Custom Certificates (Optional)
To include one or more certificates, set `NODE_EXTRA_CA_CERTS` to the certificate file-path(s) in the environment. The certificate(s) must be in _pem_ format. Be sure to escape whitespace properly based on your runner's OS. Note: This environment variable can also be used with the _Create Policy Action_.  
**Example**:   
```yaml
- name: Synopsys Detect
        uses: synopsys-sig/detect-action@main
        env:
            NODE_EXTRA_CA_CERTS: ${{ secrets.LOCAL_CA_CERT_PATH }}
        with:
            . . .
```