import { FILTER_CONDITIONS } from './grid.constants';
import { getTerm, runColumnFilter, setupFilters } from './row-searcher';

describe('row-searcher', () => {
  it('trims string terms but preserves non-string terms', () => {
    expect(getTerm({ term: '  Active  ' })).toBe('Active');
    expect(getTerm({ term: 42 })).toBe(42);
    expect(getTerm({})).toBeUndefined();
  });

  it('ignores undefined filters unless noTerm is set', () => {
    expect(setupFilters([{ term: undefined }])).toEqual([]);
    expect(setupFilters([{ term: undefined, noTerm: true }])).toHaveLength(1);
  });

  it('converts wildcard text into a regular-expression condition', () => {
    const filters = setupFilters([{ term: 'Act*ve' }]);

    expect(filters).toHaveLength(1);
    expect(filters[0].condition).toBeInstanceOf(RegExp);
    expect(runColumnFilter({ status: 'Active' }, { name: 'status' }, filters[0])).toBe(true);
    expect(runColumnFilter({ status: 'Archive' }, { name: 'status' }, filters[0])).toBe(false);
  });

  it('builds and applies standard text matchers', () => {
    const [startsWith] = setupFilters([{ term: 'Act', condition: FILTER_CONDITIONS.startsWith }]);
    const [endsWith] = setupFilters([{ term: 'ive', condition: FILTER_CONDITIONS.endsWith }]);
    const [contains] = setupFilters([{ term: 'cti', condition: FILTER_CONDITIONS.contains }]);
    const [exact] = setupFilters([{ term: 'Active', condition: FILTER_CONDITIONS.exact }]);

    expect(runColumnFilter({ status: 'Active' }, { name: 'status' }, startsWith)).toBe(true);
    expect(runColumnFilter({ status: 'Active' }, { name: 'status' }, endsWith)).toBe(true);
    expect(runColumnFilter({ status: 'Active' }, { name: 'status' }, contains)).toBe(true);
    expect(runColumnFilter({ status: 'Active' }, { name: 'status' }, exact)).toBe(true);
    expect(runColumnFilter({ status: 'Pilot' }, { name: 'status' }, exact)).toBe(false);
  });

  it('supports predicate-based filters', () => {
    const [filter] = setupFilters([
      {
        term: 200,
        condition: (term, value) => Number(value) >= Number(term)
      }
    ]);

    expect(runColumnFilter({ revenue: 250 }, { name: 'revenue' }, filter)).toBe(true);
    expect(runColumnFilter({ revenue: 150 }, { name: 'revenue' }, filter)).toBe(false);
  });

  it('supports not-equal and numeric comparison operators', () => {
    const [notEqual] = setupFilters([{ term: 'Pilot', condition: FILTER_CONDITIONS.notEqual }]);
    const [greaterThan] = setupFilters([{ term: '200', condition: FILTER_CONDITIONS.greaterThan }]);
    const [lessThanOrEqual] = setupFilters([{ term: '200', condition: FILTER_CONDITIONS.lessThanOrEqual }]);

    expect(runColumnFilter({ status: 'Active' }, { name: 'status' }, notEqual)).toBe(true);
    expect(runColumnFilter({ status: 'Pilot' }, { name: 'status' }, notEqual)).toBe(false);
    expect(runColumnFilter({ revenue: 250 }, { name: 'revenue' }, greaterThan)).toBe(true);
    expect(runColumnFilter({ revenue: 150 }, { name: 'revenue' }, greaterThan)).toBe(false);
    expect(runColumnFilter({ revenue: 200 }, { name: 'revenue' }, lessThanOrEqual)).toBe(true);
  });

  it('supports date comparison flags', () => {
    const [filter] = setupFilters([
      {
        term: '2026-02-01',
        condition: FILTER_CONDITIONS.greaterThanOrEqual,
        rawTerm: true,
        flags: { date: true }
      }
    ]);

    expect(runColumnFilter({ renewalDate: '2026-03-01' }, { name: 'renewalDate' }, filter)).toBe(true);
    expect(runColumnFilter({ renewalDate: '2026-01-01' }, { name: 'renewalDate' }, filter)).toBe(false);
  });

  it('respects case-sensitive exact filters', () => {
    const [filter] = setupFilters([
      {
        term: 'Active',
        condition: FILTER_CONDITIONS.exact,
        rawTerm: true,
        flags: { caseSensitive: true }
      }
    ]);

    expect(runColumnFilter({ status: 'Active' }, { name: 'status' }, filter)).toBe(true);
    expect(runColumnFilter({ status: 'active' }, { name: 'status' }, filter)).toBe(false);
  });

  it('supports less-than comparisons and falls through to true for unknown conditions', () => {
    const [lessThan] = setupFilters([{ term: '200', condition: FILTER_CONDITIONS.lessThan }]);
    const [unknown] = setupFilters([{ term: 'anything', condition: 'unknown' as never }]);

    expect(runColumnFilter({ revenue: 150 }, { name: 'revenue' }, lessThan)).toBe(true);
    expect(runColumnFilter({ revenue: 250 }, { name: 'revenue' }, lessThan)).toBe(false);
    expect(runColumnFilter({ status: null }, { name: 'status' }, unknown)).toBe(true);
  });
});