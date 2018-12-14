// @flow

import { Observable } from "rxjs/Observable";
import { empty, merge } from "rxjs";
import { catchError } from "rxjs/operators/catchError";

import type Transport from "@ledgerhq/hw-transport";

export type TransportModule = {
  // unique transport name that identify the transport module
  id: string,
  // open a device by an id, this id must be unique across all modules
  // you can typically prefix it with `something|` that identify it globally
  // returns falsy if the transport module can't handle this id
  open: (id: string) => ?Promise<Transport<*>>,
  // disconnect/interrupt a device connection globally
  // returns falsy if the transport module can't handle this id
  disconnect: (id: string) => ?Promise<void>,
  // optional observable that allows to discover a transport
  discovery?: Observable<{
    id: string,
    name: string
  }>
};

const modules: TransportModule[] = [];

export const registerTransportModule = (module: TransportModule) => {
  modules.push(module);
};

export const discoverDevices = (
  accept: (module: TransportModule) => boolean = () => true
): Observable<{
  type: string,
  id: string,
  name: string
}> =>
  merge(
    ...modules.filter(m => m.discovery && accept(m)).map(m =>
      (m.discovery || empty()).pipe(
        catchError(e => {
          console.warn(`One Transport provider failed: ${e}`);
          return empty();
        })
      )
    )
  );

export const open = (deviceId: string): Promise<Transport<*>> => {
  for (let i = 0; i < modules.length; i++) {
    const open = modules[i].open;
    const p = open(deviceId);
    if (p) {
      if (process.env.NODE_ENV !== "production") {
        return p.then(p => {
          p.setDebugMode(true);
          return p;
        });
      }
      return p;
    }
  }
  return Promise.reject(new Error(`Can't find handler to open ${deviceId}`));
};

export const disconnect = (deviceId: string): Promise<void> => {
  for (let i = 0; i < modules.length; i++) {
    const dis = modules[i].disconnect;
    const p = dis(deviceId);
    if (p) {
      return p;
    }
  }
  return Promise.reject(
    new Error(`Can't find handler to disconnect ${deviceId}`)
  );
};
