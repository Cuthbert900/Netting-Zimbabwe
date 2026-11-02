import { describe, it, expect } from 'vitest';
import { UnionFind } from './clustering';

describe('UnionFind', () => {
  it('should initialize each element in its own set', () => {
    const uf = new UnionFind();
    expect(uf.find('a')).toBe('a');
    expect(uf.find('b')).toBe('b');
  });

  it('should merge two sets with union', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    expect(uf.find('a')).toBe(uf.find('b'));
  });

  it('should handle multiple union operations correctly', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    uf.union('c', 'd');
    uf.union('a', 'c');
    expect(uf.find('a')).toBe(uf.find('b'));
    expect(uf.find('c')).toBe(uf.find('d'));
    expect(uf.find('a')).toBe(uf.find('d'));
  });

  it('should return the same root for all elements in a set', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    uf.union('b', 'c');
    uf.union('d', 'e');
    const root = uf.find('a');
    expect(uf.find('b')).toBe(root);
    expect(uf.find('c')).toBe(root);
    expect(uf.find('d')).not.toBe(root);
    expect(uf.find('e')).not.toBe(root);
  });
});
