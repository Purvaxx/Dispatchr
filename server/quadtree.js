/**
 * QuadTree — spatial index for fast "nearest driver" lookups.
 *
 * Why not brute force? Scanning every driver on every ride request is O(n)
 * per request. A quadtree lets us only examine drivers in the region near
 * the rider, giving average O(log n) lookups — the same idea real
 * dispatch systems (Uber's H3, geohashing, etc.) use, just simplified.
 */

class Rectangle {
  constructor(x, y, halfW, halfH) {
    this.x = x;
    this.y = y;
    this.halfW = halfW;
    this.halfH = halfH;
  }

  contains(point) {
    return (
      point.x >= this.x - this.halfW &&
      point.x <= this.x + this.halfW &&
      point.y >= this.y - this.halfH &&
      point.y <= this.y + this.halfH
    );
  }

  intersects(range) {
    return !(
      range.x - range.halfW > this.x + this.halfW ||
      range.x + range.halfW < this.x - this.halfW ||
      range.y - range.halfH > this.y + this.halfH ||
      range.y + range.halfH < this.y - this.halfH
    );
  }
}

class QuadTree {
  constructor(boundary, capacity = 4) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.points = [];
    this.divided = false;
  }

  subdivide() {
    const { x, y, halfW, halfH } = this.boundary;
    const qw = halfW / 2;
    const qh = halfH / 2;

    this.northeast = new QuadTree(new Rectangle(x + qw, y - qh, qw, qh), this.capacity);
    this.northwest = new QuadTree(new Rectangle(x - qw, y - qh, qw, qh), this.capacity);
    this.southeast = new QuadTree(new Rectangle(x + qw, y + qh, qw, qh), this.capacity);
    this.southwest = new QuadTree(new Rectangle(x - qw, y + qh, qw, qh), this.capacity);
    this.divided = true;
  }

  insert(point) {
    if (!this.boundary.contains(point)) return false;

    if (this.points.length < this.capacity && !this.divided) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) this.subdivide();

    return (
      this.northeast.insert(point) ||
      this.northwest.insert(point) ||
      this.southeast.insert(point) ||
      this.southwest.insert(point)
    );
  }

  query(range, found = []) {
    if (!this.boundary.intersects(range)) return found;

    for (const p of this.points) {
      if (range.contains(p)) found.push(p);
    }

    if (this.divided) {
      this.northwest.query(range, found);
      this.northeast.query(range, found);
      this.southwest.query(range, found);
      this.southeast.query(range, found);
    }

    return found;
  }

  /**
   * Nearest-neighbor search via expanding-radius query.
   * Starts with a small search box around (x, y) and doubles it until
   * candidates are found, then picks the true closest by distance.
   * Avoids scanning the whole tree when the answer is usually nearby.
   */
  nearest(x, y, maxRadius = 5000) {
    let radius = 50;
    let candidates = [];

    while (candidates.length === 0 && radius <= maxRadius) {
      const range = new Rectangle(x, y, radius, radius);
      candidates = this.query(range, []);
      radius *= 2;
    }

    if (candidates.length === 0) return null;

    let best = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return { driver: best, distance: bestDist };
  }
}

module.exports = { QuadTree, Rectangle };
