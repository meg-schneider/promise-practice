const STATE = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected'
}

class MyPromise {
  #value
  #state = STATE.PENDING;
  #onSuccessBind = this.#onSuccess.bind(this)
  #onFailBind = this.#onFail.bind(this)
  #thenCbs = [];
  #catchCbs = [];

  constructor(cb) {
    try {
      cb(this.#onSuccessBind, this.#onFailBind)
    } catch(error) {
      this.#onFail(error)
    }
  }

  #runCallbacks() {
    if (this.#state === STATE.FULFILLED) {
      this.#thenCbs.forEach(cb => {
        cb(this.#value)
      })
      this.#thenCbs = [];
    }
    if (this.#state === STATE.REJECTED) {
      this.#catchCbs.forEach(cb => {
        cb(this.#value)
      })
      this.#catchCbs = [];
    }
  }
 

  #onSuccess(value) {
    queueMicrotask(() =>{
      if (this.#state !== STATE.PENDING) return

      if (value instanceof MyPromise) {
        value.then(this.#onSuccessBind, this.#onFailBind)
        return
      }

      this.#value = value;
      this.#state = STATE.FULFILLED;
      this.#runCallbacks();
    })
    
  }

  #onFail(value) {
    queueMicrotask(() => {
      if (this.#state !== STATE.PENDING) return

      if (value instanceof MyPromise) {
        value.then(this.#onSuccessBind, this.#onFailBind)
        return
      }

      if (this.#catchCbs.length === 0) {
        throw new UncaughtPromiseError(value)
      }

      this.#value = value;
      this.#state = STATE.REJECTED;
      this.#runCallbacks();
    })
  }

  then(thenCb, catchCb) {
    return new MyPromise((resolve, reject) => {
      this.#thenCbs.push(result => {
        if (thenCb == null) {
          resolve(result)
          return
        }
        try {
          resolve(thenCb(result))
        } catch(error) {
          reject(error)
        }
      })

      this.#catchCbs.push(result => {
        if (catchCb == null) {
          reject(result)
        }
        try {
          resolve(catchCb(result))
        } catch(error) {
          reject(error)
        }
      })
    })
  }

  catch(cb) {
    return this.then(undefined, cb)
  }

  finally(cb) {
    return this.then(result => {
      cb()
      return result
    }, result => {
      cb()
      throw result
    })
  }

  static resolve(value) {
    return new MyPromise(resolve => {
      resolve(value)
    })
  }

  static reject(value) {
    return new MyPromise((resolve, reject) => {
      reject(value)
    })
  }

  static all(promises) {
    const results = [];
    let completedPromises = 0;
    return new MyPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise
          .then(value => {
            results[i] = value;
            completedPromises++;
            if (completedPromises === promises.length) {
              resolve(results)
            }
          })
          .catch(reject)
      }
    })
  } 

  static allSettled(promises) {
    const results = [];
    let completedPromises = 0;
    return new MyPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise
          .then(value => {
            results[i] = { status: STATE.FULFILLED, value: value}
          })
          .catch(reason => {
            results[i] = { status: STATE.REJECTED, reason }
          })
          .finally(() => {
            completedPromises++;
            if (completedPromises === promises.length) {
              resolve(results)
            }
          })
      }
    })
    
  }

  static race(promises) {
    return new MyPromise((resolve, reject) => {
      promises.forEach(promise => {
        promise.then(resolve).catch(reject)
      })
    })
  }

  static any(promises) {
    const errors = [];
    let brokenPromises = 0;
    return new MyPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i]
        promise
          .then(resolve)
          .catch(value => {
            brokenPromises++;
            errors[i] = value;
            if (brokenPromises === promises.length) {
              reject(new AggregateError(errors, 'all promises broken'))
            }
          })
      }
    })
  }
}

class UncaughtPromiseError extends Error {
  constructor(error) {
    super(error)

    this.stack = `(in promise) ${error.stack}`
  }
}

module.exports = MyPromise