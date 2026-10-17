import base from './playwright.account-refinement.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,testMatch:['calendar-followup.spec.ts','drawer-followup.spec.ts','floating-actions.spec.ts','account-insights.spec.ts'],outputDir:'test-results-calendar-followup',use:{...base.use,baseURL:'http://127.0.0.1:5242/chore-app/'},webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5242 --strictPort',url:'http://127.0.0.1:5242/chore-app/',reuseExistingServer:false}});
