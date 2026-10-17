import base from './playwright.spacing.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,outputDir:'../nesmi-spacing-followup/webkit',use:{...base.use,launchOptions:{}},projects:[{name:'webkit',use:{browserName:'webkit'}}]});
