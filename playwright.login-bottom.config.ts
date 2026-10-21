import base from './playwright.mobile-review.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,testMatch:['login-bottom.spec.ts'],outputDir:process.env.LAYOUT_BASELINE?'../login-bottom-before':'../login-bottom-after'});
