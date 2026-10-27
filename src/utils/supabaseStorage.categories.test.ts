/**
 * Offline Nesmi category write receipt contract. No network, real users,
 * accounts, or production database mutations. These adapter fixtures model
 * a PostgREST success response with zero RLS-visible affected rows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { updateCategory, deleteCategory } from './supabaseStorage';
import type { Category } from '../types';

const category: Category = { id: 'synthetic-category', name: 'Household', color: '#445566', icon: 'home' };
type Receipt = { data: { id: string }[] | null; error: { message: string } | null };

function receiptFixture(response: Receipt) {
  const select = vi.fn().mockResolvedValue(response);
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const deleteRow = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update, delete: deleteRow });
  Object.assign(supabase, { from });
  return { from, update, deleteRow, eq, select };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('Nesmi category mutation acknowledgements', () => {
  it('acknowledges only the exact category updated, retaining its intended fields', async () => {
    const f = receiptFixture({ data: [{ id: category.id }], error: null });
    await expect(updateCategory(category)).resolves.toBe(true);
    expect(f.from).toHaveBeenCalledWith('categories');
    expect(f.update).toHaveBeenCalledWith({ name: 'Household', color: '#445566', icon: 'home' });
    expect(f.eq).toHaveBeenCalledWith('id', category.id);
    expect(f.select).toHaveBeenCalledWith('id');
  });

  it.each([
    ['zero-row / hidden by RLS', { data: [], error: null }],
    ['null response', { data: null, error: null }],
    ['wrong identity', { data: [{ id: 'another-category' }], error: null }],
    ['more than one receipt', { data: [{ id: category.id }, { id: 'another-category' }], error: null }],
    ['PostgREST rejection', { data: null, error: { message: 'synthetic denied' } }],
  ] satisfies Array<[string, Receipt]>)('rejects category update with %s', async (_name, reply) => {
    receiptFixture(reply);
    await expect(updateCategory(category)).rejects.toThrow('Could not update category');
  });

  it('confirms exact category deletion before local removal', async () => {
    const f = receiptFixture({ data: [{ id: category.id }], error: null });
    await expect(deleteCategory(category.id)).resolves.toBe(true);
    expect(f.from).toHaveBeenCalledWith('categories');
    expect(f.deleteRow).toHaveBeenCalledOnce();
    expect(f.eq).toHaveBeenCalledWith('id', category.id);
    expect(f.select).toHaveBeenCalledWith('id');
  });

  it.each([
    ['zero-row / hidden by RLS', { data: [], error: null }],
    ['null response', { data: null, error: null }],
    ['wrong identity', { data: [{ id: 'another-category' }], error: null }],
    ['more than one receipt', { data: [{ id: category.id }, { id: 'another-category' }], error: null }],
    ['PostgREST rejection', { data: null, error: { message: 'synthetic denied' } }],
  ] satisfies Array<[string, Receipt]>)('rejects category deletion with %s', async (_name, reply) => {
    receiptFixture(reply);
    await expect(deleteCategory(category.id)).rejects.toThrow('Could not delete category');
  });
});
