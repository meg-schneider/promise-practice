const STATE = {
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
  PENDING: 'pending'
}

class MyPromise {
  
  #thenCbs = [];
  #catchCbs = [];
  //pending, rejected, fulfilled
  #state = STATE.PENDING
  //contains val from onsuccess or onfail
  #value
  #onSuccessBind = this.#onSuccess.bind(this)
  #onFailBind = this.#onFail.bind(this)

  // pass a callback into constructor which will get passed into the promise
    // every time you you create a promise it immediately calls the callback that was passed into it-- need to pass methods into it for success and failure
    // wrapped in try catch because if it fails it's just going to call the fail method
  constructor(cb) {
    
    try {
      cb(this.#onSuccessBind, this.#onFailBind)
    } catch (e) {
      this.onFail(e)
    }
  }
  // if we're successful, run all the then cbs 
  // must reset the array so the callbacks that we've already run don't get called in the future
  #runCallbacks() {
    
    if (this.#state === STATE.FULFILLED) {
      this.#thenCbs.forEach(callback => {
        callback(this.#value)
      })

      this.#thenCbs = [];
    }
    // if we're failed, run all the catch cbs 
    if (this.#state === STATE.REJECTED) {
      this.#catchCbs.forEach(callback => {
        callback(this.#value)
      })
      this.#catchCbs = []
    }
  }

  // these need to store the state variables  
  #onSuccess(value) {
    queueMicrotask(() => {
      if (this.#state !== STATE.PENDING) return

      if (value instanceof MyPromise) {
        value.then(this.#onSuccessBind, this.#onFailBind)
        return
      }
  
      this.#value = value
      this.#state = STATE.FULFILLED
      this.#runCallbacks()
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

      this.#value = value
      this.#state = STATE.REJECTED
      this.#runCallbacks()
    })
    
  }
  // then: resolves to the value that the handler function returns or, 
  // if that returns a promise, 
  // waits for that promise and then resolves to its result
  then(thenCb, catchCb) {
    return new MyPromise((resolve, reject) => {
      this.#thenCbs.push(result => {
        if (thenCb == null) {
          resolve(result)
          return;
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
          return;
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

   // this promise never gets any value passed to it
    // can perform a cleanup task like closing a network, 
    // regardless of whether the promise sucdeeded or failed.
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

  /*
  Given an array of promises, Promise.all returns a promise that waits 
  for all of the promises in the array to finish. It then succeeds, 
  yielding an array of result values. If a promise in the array fails, 
  the promise returned by all fails too, with the failure reason 
  from the failing promise.
  */
  /* 
  The function passed to the Promise constructor will have to call then 
  on each of the promises in the given array. When one of them succeeds, 
  two things need to happen. The resulting value needs to be stored in the 
  correct position of the result array, and we must check whether this was 
  the last pending promise and finish our own promise if it was
  */
  static all(promises) {
    const results = [];
    let completedPromises = 0;
    return new MyPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise.then(value => {
          completedPromises++;
          results[i] = value;
          if (completedPromises === promises.length) {
            resolve(results)
          }
        }).catch(reject)
      }
    })
  }

  // waits for every promise to finish (whether it succeeds or fails) and saves the results
  // does not use reject method because allSettled never rejects! it's always successful because they all run
  static allSettled(promises) {
    const results = [];
    let completedPromises = 0;
    return new MyPromise((resolve) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise
          .then(value => {
            results[i] = { status: STATE.FULFILLED, value: value }
          })
          .catch(reason => {
            results[i] = { status: STATE.REJECTED, reason }
          })
          .finally(() => {
            completedPromises++;
            if (completedPromises === promises.length) {
              resolve(results);
            }
          })
      }
    })
  }

  // takes the first promise that succeeds or fails and returns it
  static race(promises) {
    return new MyPromise((resolve, reject) => {
      promises.forEach(promise => {
        promise.then(resolve).catch(reject)
      })
    })
  }

  // similar to race, resolves with the first one that succeeds. 
  // does NOT return on failure unless every single promise passed to it fails.
  static any(promises) {
    const errors = [];
    let rejectedPromises = 0;
    return new MyPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise
          .then(resolve)
          .catch(value => {
            rejectedPromises++
            errors[i] = value;
            if (rejectedPromises === promises.length) {
              reject(new AggregateError(errors, 'All promises were rejected'))
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

// .then gets called when all Promises finish
// .catch is called if there's a single error with any Promise
// Promise.all(p1, p2, p3).then([v1, v2, v3]).catch(e => )

// const p = new Promise((resolve, reject) => {
//   resolve('hi')
//   reject('error')
// }).then(
//   () => {}, 
//   () => {})
