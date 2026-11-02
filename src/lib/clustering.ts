/**
 * A Union-Find data structure for clustering records.
 * This class is used to group records that have been matched across multiple
 * source pairs (e.g., bank↔prism and prism↔dynamics) into a single, unified group.
 */
export class UnionFind {
  private parent = new Map<string, string>();

  /**
   * Finds the representative (or root) of the set containing element `x`.
   * Implements path compression for optimization.
   * @param x The element to find.
   * @returns The representative of the set containing `x`.
   */
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  /**
   * Merges the sets containing elements `a` and `b`.
   * @param a The first element.
   * @param b The second element.
   */
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}
