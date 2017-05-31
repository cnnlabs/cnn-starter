#!/usr/bin/env node

const chalk = require('chalk');
const fse = require('fs-extra');
const kebabCase = require('lodash.kebabcase');
const path = require('path');
const program = require('commander');
const spawn = require('child_process').spawn;
const execSync = require('child_process').execSync;
const packageJSON = require('../package.json');

const log = console;

// @TODO: this should be eventually called if there is an error during installation.
function removeDirectory(dir) {}

/**
 * Makes sure the project name does not conflict with an existing directory.
 *
 * @param {String} root - Full path of the project
 * @param {Function} callback - Next step in the pipeline.
 * @return {undefined}
 */
function validateDirectory(root, callback) {
    const name = path.basename(root);
    function handler(err) {
        if (!err) {
            log.error(chalk.red(`A directory by the name of ${chalk.bold(name)} already exists, please choose another name.`));
        } else if (err.code === 'ENOENT') {
            // if there is no directory, we are safe to proceed
            callback();
        }
    }
    log.info(chalk.gray('Checking potential directory conflicts.'));
    fse.access(root, handler);
}

/**
 *
 * @param {String} root - Full path of the project
 * @param {Function} callback - Next step in the pipeline.
 * @return {undefined}
 */
function createEmptyProject(root, callback) {
    const file = path.join(root, 'package.json');

    const contents = {
        name: path.basename(root),
        version: '0.1.0',
        private: true
    };

    const options = { spaces: 2 };

    function handler(err) {
        if (err) { throw err };
        callback();
    }

    log.info(chalk.gray('Creating new project.'));

    fse.outputJson(file, contents, options, handler);
}

/**
 *
 * @param {String} root - Full path of the project
 * @param {Function} callback - Next step in the pipeline.
 * @return {undefined}
 */
function changeDirectory(root, callback) {
    try {
        process.chdir(root);
        callback();

    } catch (err) {
        log.error(chalk.red(`Error while attempting to change directory: ${err}`));
    }
}

/**
 *
 * @param {String} override - Alternate `cnn-starter-templates` package location to use.
 * @param {Function} callback - Next step in the pipeline.
 * @return {undefined}
 */
function installPackage(override, callback) {
    const packageName = 'cnn-starter-proxy';
    const uri = override || `https://github.com/cnnlabs/${packageName}.git`;

    let command = 'npm';
    let args = ['i', '-E', uri];

    // if (isYarnInstalled()) {
    //     command = 'yarn';
    //     args = ['add', '-D', '-E', uri];
    // }

    log.info(chalk.gray(`Installing latest version of ${chalk.bold(packageName)} using ${chalk.bold(command)}`));

    const child = spawn(command, args, { stdio: 'inherit' });

    child.on('close', (code) => {
        if (code !== 0) {
            log.error(chalk.red(`${code} ${command} ${args.join(' ')} failed.`));
            process.exit(1);
        }
        callback()(packageName);
    });
}

/**
 * Hand everything off to `cnn-starter-proxy`.
 *
 * @param {String} root - Full path of the project
 * @return {undefined}
 */
function run(root) {
    return (packageName) => {
        const packagePath = path.resolve(process.cwd(), 'node_modules', packageName, 'src', 'index.js');
        const init = require(packagePath);
        init(root);
    }
}

/**
 * Normalize node version.
 *
 * @example
 * `formatNodeVersion('>=6.4.2') => '6.4.2'`
 *
 * @param {String} str - Node version
 * @return {String} Containing only Numbers and periods.
 */
function formatNodeVersion(str) {
    return str.replace(/[^0-9.-]/g, '');
}

function checkNodeVersion(callback) {
    const required = packageJSON.engines.node;
    const current = process.versions.node;

    log.info(chalk.gray('Checking node version.'));

    if (formatNodeVersion(current) < formatNodeVersion(required)) {
        log.error(chalk.red(`You are running node version ${chalk.bold(current)}, but should be running at least ${chalk.bold(required)}`));
        log.error(chalk.red('Update node and try again.'));
        process.exit(1);
    }

    callback();
}

/**
 * Formats project name into a normalized string.
 *
 * @param {String} name - Project name.
 * @return {String} Formatted name.
 */
function formatName(name) {
    return kebabCase(name);
}

/**
 * Check if yarn is installed.
 *
 * @return {Boolean}
 */
function isYarnInstalled() {
    try {
        execSync('yarnpkg --version', { stdio: 'ignore' });
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Take CLI input and start the process of creating a new project.
 *
 * @param {String} name - User input name of project to be created.
 * @return {undefined}
 */
function handleInput(name) {

    const project = formatName(name);
    const root = path.resolve(project);

    const step6 = run.bind(null, root);
    const step5 = installPackage.bind(null, program.override, step6);
    const step4 = changeDirectory.bind(null, root, step5);
    const step3 = createEmptyProject.bind(null, root, step4);
    const step2 = validateDirectory.bind(null, root, step3);
    const step1 = checkNodeVersion.bind(null, step2);

    step1();
}

// Kick off CLI.
program
    .version(packageJSON.version)
    .usage('<project-name>')
    .description('Create standardized CNN projects.')
    .option('-o, --override <uri>', 'use a different version of templates')
    .action(handleInput)
    .parse(process.argv);

if (!program.args.length) { program.help(); }
