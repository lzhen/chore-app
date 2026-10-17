import {expect, Page} from '@playwright/test';

// Appearance lives in Account; return to the page under test after changing it.
export async function selectAppearance(page: Page, theme: string) {
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 const selected=await nav.locator('[aria-current="page"]').innerText();
 await nav.getByRole('button',{name:'Account',exact:true}).click();
 if(await page.locator('html').getAttribute('data-theme')!==theme)
  await page.getByRole('button',{name:`Switch to ${theme} mode`,exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
 await nav.getByRole('button',{name:selected.trim(),exact:true}).click();
}

export async function openInsights(page: Page) {
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Account',exact:true}).click();
 await page.getByRole('button',{name:'View activity',exact:true}).click();
 await expect(page.getByRole('button',{name:'Overview',exact:true})).toBeVisible();
}
