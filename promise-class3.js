const STATE = {
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
  PENDING: 'pending'
}

class MyPromise {
  #thenCbs = [];
  #catchCbs = [];
  #state = STATE.PENDING;
  #value
  #onSuccessBinded = this.#onSuccess.bind(this); 
  #onFailBinded = this.#onFail.bind(this);
  // resolve, reject are parameters of the callback
  constructor(cb) {
    // wrapped in try catch so it will catch the error whenever it arises
    try {
      cb(this.#onSuccessBinded, this.#onFailBinded)
    } catch (e) {
      this.#onFail(e)
    }
  }

  #runCallbacks() {
    if (this.#state === STATE.FULFILLED) {
      this.#thenCbs.forEach(callback => {
        callback(this.#value);
      })
      //remove the rest of cbs from list so they can no longer be called
      this.#thenCbs = [];
    }
    if (this.#state === STATE.REJECTED) {
      this.#catchCbs.forEach(callback => {
        callback(this.#value)
      })

      this.#catchCbs = [];
    }
  }
  // #private methods, not available outside this class
  #onSuccess(value) { 
    queueMicrotask(() => {
      if (this.#state != STATE.PENDING) return
      // if we have a promise being returned from another promise,
      // we need to wait for that promise to finish up and then call the 
      // success or fail method based on that promise's result
      if (value instanceof MyPromise) {
        value.then(this.#onSuccessBinded, this.#onFailBinded)
        return
      }
  
      this.#value = value;
      this.#state = STATE.FULFILLED;
      this.#runCallbacks()
    })
    
  }

  #onFail(value) {
    queueMicrotask(() => {
      if (this.#state != STATE.PENDING) return

      if (value instanceof MyPromise) {
        value.then(this.#onSuccessBinded, this.#onFailBinded)
        return
      }

      if (this.#catchCbs.length === 0) {
        throw new UncaughtPromiseError
      }

      this.#value = value;
      this.#state = STATE.REJECTED
      this.#runCallbacks()
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
        } catch (error) {
          reject(error)
        }
      }) 

      this.#catchCbs.push(result => {
        if (catchCb == null) {
          reject(result)
          return
        }
        try {
          resolve(catchCb(result))
        } catch (error) {
          reject(error)
        }
      })

      this.#runCallbacks()
    })  
  }

  catch(cb) {
    return this.then(undefined, cb)
  }

  finally(cb) {
    // this promise never gets any value passed to it
    // can perform a cleanup task like closing a network, regardless
    // of whether the promise sucdeeded or failed.
    return this.then(result => {
      cb()
      return result
    }, 
    result => {
      cb()
      throw result
    })
  }

  static resolve(value) {
    return new MyPromise((resolve) => {
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
        promise.then(value => {
          completedPromises++
          results[i] = value;
          if (completedPromises === promises.length) {
            resolve(results)
          }
        }).catch(reject);
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
            results[i] = { status: STATE.FULFILLED, value }
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

  //returns the first one that succeeds
  // BUT it doesn't return on failure unless every single promise passed to it fails
  // THEN and only then will it return on failure
  // (works like all but in reverse)
  static any(promises) {
    const errors = [];
    let rejectedPromises = 0;
    return new MyPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise
          .then(resolve)
          .catch(value => {
            rejectedPromises++;
            errors[i] = value;
            if (rejectedPromises === promises.length) {
              reject(new AggregateError(errors, 'All promises rejected'))
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

module.exports = MyPromise;