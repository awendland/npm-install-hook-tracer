import { performance, PerformanceObserverEntryList } from 'perf_hooks'

/**
 * Create an Object from an array of key value pairs
 *
 * To be used like: .reduce(objectify, {})
 */
export const objectify = <K extends string | number, V, O extends {}>(obj: O, [k, v]: [K, V]): O => Object.assign(obj, {[k]: v})

