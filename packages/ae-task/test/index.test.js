
import Task from '../src';

const delay = (duration, cancel = clearTimeout) => Task((reject, resolve) => {
  const timerid = setTimeout(() => resolve(), duration);
  return () => cancel && cancel(timerid);
});

describe('Task', () => {

  describe('Task.race', () => {
    it('should race to the finish line and resolve with the first', done => {
      const t1 = delay(200).map(() => 1);
      const t2 = delay(100).map(() => 2);
      const t3 = delay(300).map(() => 3);
      Task.race([ t1, t2, t3 ]).fork(done, (n) => {
        expect(n).toBe(2);
        done();
      });
    });

    it('should race to the finish line and reject with the first', done => {
      const t1 = delay(200).map(() => 1);
      const t2 = delay(100).rejectWith(2);
      const t3 = delay(300).rejectWith(3);
      Task.race([ t1, t2, t3 ]).fork(n => {
        expect(n).toBe(2);
        done();
      }, () => done('Shoudnbe here'));
    });
  });

  describe('Task.series', () => {
    it('should run all tasks in series', done => {
      const t1 = delay(50).map(() => 1);
      const t2 = delay(70).map(() => 2);
      const t3 = delay(90).map(() => 3);

      const startTime = Date.now();
      Task.series([ t1, t2, t3 ]).fork(done, arr => {
        expect(Date.now() - startTime).toBeGreaterThanOrEqual(200);
        expect(arr).toEqual([ 1, 2, 3 ]);
        done();
      });
    });

    it('should reject with the first one (lowest index) that fails', done => {
      const t1 = delay(50).map(() => 1);
      const t2 = delay(80).rejectWith(2);
      const t3 = delay(100).rejectWith(3);
      Task.series([ t1, t2, t3 ]).fork(n => {
        expect(n).toBe(2);
        done();
      }, () => done('Shoudnbe here'));
    });
  });

  describe('Task.parallel', () => {
    it('should run all tasks in parallel', done => {
      const t1 = delay(100).map(() => 1);
      const t2 = delay(20).map(() => 2);
      const t3 = delay(120).map(() => 3);
      const t4 = delay(90).map(() => 4);

      const startTime = Date.now();
      Task.parallel([ t1, t2, t3, t4 ]).fork(done, arr => {
        expect(Date.now() - startTime).toBeGreaterThanOrEqual(120);
        expect(Date.now() - startTime).toBeLessThan(200);
        expect(arr).toEqual([ 1, 2, 3, 4 ]);
        done();
      });
    });

    it('should reject with the first one (first in time) that fails', done => {
      const t1 = delay(100).map(() => 1);
      const t2 = delay(20).map(() => 2);
      const t3 = delay(120).map(() => 3);
      const t4 = delay(90).rejectWith(4);

      Task.series([ t1, t2, t3, t4 ]).fork(n => {
        expect(n).toBe(4);
        done();
      }, () => done('Shoudnbe here'));
    });
  });

  describe('Task.fromPromise', () => {
    it('should convert a promise factory into a task', done => {
      Task.fromPromise(() => Promise.resolve(5))
        .fork(done, (n) => {
          expect(n).toBe(5);
          done();
        });
    });

    it('should convert a promise factory into a task', done => {
      Task.fromPromise(() => Promise.reject(5))
        .fork((n) => {
          expect(n).toBe(5);
          done();
        }, done);
    });
  });

  describe('#resolveWith, #rejectWith', () => {
    it('should ignore previous operations and just resolve with a value', done => {
      const t = Task.resolved(5).map(x => x * 2).resolveWith(9);
      t.fork(done, n => {
        expect(n).toBe(9);
        done();
      });
    });

    it('should ignore previous operations and reject with value', done => {
      const t = Task.rejected(5).map(x => x * 2).mapRejected(x => x * 5).rejectWith(4);
      t.fork(n => {
        expect(n).toBe(4);
        done();
      }, () => done('Shouldnt be here'));
    });
  });

  describe('#fork', () => {
    it('should call the second callback (for resolved)', done => {
      const t = Task.resolved(5);
      t.fork(done, n => {
        expect(n).toBe(5);
        done();
      });
    });

    it('should call the first callback (for rejected)', done => {
      const t = Task.rejected(5);
      t.fork(n => {
        expect(n).toBe(5);
        done();
      }, () => done('Shouldnt be here'));
    });
  });

  describe('#fold', () => {
    const foldToObj = t => t.fold(error => ({ error }), value => ({ value }));

    it('should group both rejected and resolved response to one', done => {
      foldToObj(Task.resolved(5)).fork(done, ({ error, value }) => {
        expect(error).toBeUndefined();
        expect(value).toBe(5);
        done();
      });
    });

    it('should call the first callback (for rejected)', done => {
      const e = new Error('Www');
      foldToObj(Task.rejected(e)).fork(done, ({ error, value }) => {
        expect(error).toBe(e);
        expect(value).toBeUndefined();
        done();
      });
    });
  });

  describe('#map', () => {
    it('should map over the given value for resolved task', done => {
      const t = Task.resolved(5).map(x => x * 2);
      t.fork(done, n => {
        expect(n).toBe(10);
        done();
      });
    });

    it('should ignore for rejected task', done => {
      const t = Task.rejected(5).map(x => x * 2);
      t.fork(n => {
        expect(n).toBe(5);
        done();
      }, () => done('Shouldnt be here'));
    });
  });

  describe('#mapRejected', () => {
    it('should ignore for resolved task', done => {
      const t = Task.rejected(5).mapRejected(x => x * 2);
      t.fork(n => {
        expect(n).toBe(10);
        done();
      }, () => done('Shouldnt be here'));
    });

    it('should map over the given value for rejected task', done => {
      const t = Task.resolved(5).mapRejected(x => x * 2);
      t.fork(done, n => {
        expect(n).toBe(5);
        done();
      });
    });
  });

  describe('#bimap', () => {
    const mapper = t => t.bimap(x => x * 2, y => y * 3);

    it('should map over the given value for resolved task', done => {
      mapper(Task.resolved(5)).fork(done, n => {
        expect(n).toBe(15);
        done();
      });
    });

    it('should ignore for rejected task', done => {
      mapper(Task.rejected(5)).fork(n => {
        expect(n).toBe(10);
        done();
      }, () => done('Shouldnt be here'));
    });
  });

  describe('#chain', () => {
    it('should map over the given value and merge nested task for resolved task', done => {
      const t = Task.resolved(5).chain(x => Task.resolved(2 * x));
      t.fork(done, n => {
        expect(n).toBe(10);
        done();
      });
    });

    it('should ignore for rejected task', done => {
      const t = Task.rejected(5).chain(x => Task.resolved(2 * x));
      t.fork(n => {
        expect(n).toBe(5);
        done();
      }, () => done('Shouldnt be here'));
    });

    it('should throw error if result is not a task', () => {
      const t = Task.resolved(5).chain(x => 2 * x);
      expect(() => t.fork(() => {}, () => {})).toThrowError();
    });
  });

  describe('#empty', () => {
    it('should ignore previous operations and never resolve or reject', done => {
      const t = Task.resolved(5)
        .map(x => x + 1)
        .chain(x => Task.resolved(2 * x))
        .empty()
        .map(x => x + 5);

      t.fork(done, done); // Wont call either one of the pipes

      setTimeout(() => done(), 100);
    });
  });

  describe('#toPromise', () => {
    it('should return a resolved promise', done => {
      const t = Task.resolved(5)
        .map(x => x + 1)
        .chain(x => Task.resolved(2 * x))
        .map(x => x + 5);

      t.toPromise()
        .then(d => {
          expect(d).toBe(17);
          done();
        })
        .catch(done);
    });

    it('should return a resolved promise', done => {
      const t = Task.rejected(5)
        .map(x => x + 1)
        .chain(x => Task.resolved(2 * x))
        .map(x => x + 5);

      t.toPromise()
        .then(() => done('shoundt be here'))
        .catch(n => {
          expect(n).toBe(5);
          done();
        });
    });
  });

  describe('Timeout example (integrated test)', () => {
    it('should delay (combination test of map, chain and fork)', done => {
      const start = Date.now();
      delay(100)
        .map(() => 100)
        .map(n => n + 50)
        .chain(delay)
        .map(() => 10)
        .fork(done, x => {
          expect(x).toBe(10);
          expect(Date.now() - start).toBeGreaterThanOrEqual(200);
          done();
        });
    });

    it('should reject', done => {
      const err = new Error('Eoww');
      Task.rejected(err)
        .fork(
          e => {
            expect(e).toBe(err);
            done();
          },
          () => done('shouldnt have reached here'),
        );
    });

    it('should cancel without cancel handler', done => {
      const cancel = delay(50, () => {}).fork(done, () => done('shouldnt have reached here'));
      cancel();
      setTimeout(() => done(), 150);
    });

    it('should cancel', done => {
      const cancel = delay(50).fork(done, () => done('shouldnt have reached here'));
      cancel();
      setTimeout(() => done(), 150);
    });
  });
});

