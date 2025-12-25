#!/usr/bin/env node
import { Command } from 'commander';
import publishCommand from './commands/publish.js';

const program = new Command();

program
    .name('lab')
    .description('CLI tools for The Human Pattern Lab')
    .version('0.1.0');

program.addCommand(publishCommand);

program.parse();
