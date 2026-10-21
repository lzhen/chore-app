import base from './playwright.mobile-review.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,testMatch:['alignment.spec.ts','floating-actions.spec.ts'],outputDir:'../alignment-results'});
