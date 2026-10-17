import base from './playwright.calendar-followup.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,workers:1,globalTimeout:120000,testMatch:['calendar-spacing.spec.ts'],outputDir:process.env.SPACING_BASELINE?'../nesmi-spacing-followup/before':'../nesmi-spacing-followup/after'});
