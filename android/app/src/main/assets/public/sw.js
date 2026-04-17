/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-ca84f546'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "b48b5f412db75409ed157253c3c0fcf3"
  }, {
    "url": "assets/workbox-window.prod.es5-BIl4cyR9.js",
    "revision": null
  }, {
    "url": "assets/vendor-ui-vjrLvEGV.js",
    "revision": null
  }, {
    "url": "assets/vendor-react-CWzAdjiE.js",
    "revision": null
  }, {
    "url": "assets/vendor-firebase-Ckoi0oR6.js",
    "revision": null
  }, {
    "url": "assets/vendor-db-qlHQlgqb.js",
    "revision": null
  }, {
    "url": "assets/vendor-charts-QSlfisd8.js",
    "revision": null
  }, {
    "url": "assets/useCompositeListItem-6udQbvd2.js",
    "revision": null
  }, {
    "url": "assets/textarea-DEcwS0tg.js",
    "revision": null
  }, {
    "url": "assets/tabs-DPC-rQmk.js",
    "revision": null
  }, {
    "url": "assets/table-CFSldpB0.js",
    "revision": null
  }, {
    "url": "assets/select-CYoEjsSY.js",
    "revision": null
  }, {
    "url": "assets/scroll-area-DuUc7V_J.js",
    "revision": null
  }, {
    "url": "assets/react-barcode-DySeKCT-.js",
    "revision": null
  }, {
    "url": "assets/purify.es-B5CD4DQe.js",
    "revision": null
  }, {
    "url": "assets/proxy-DvVkfIQP.js",
    "revision": null
  }, {
    "url": "assets/label-Bed42atz.js",
    "revision": null
  }, {
    "url": "assets/index.es-DnQM7aJ4.js",
    "revision": null
  }, {
    "url": "assets/index-DnUOZMs8.js",
    "revision": null
  }, {
    "url": "assets/index-Bks6-1Rf.css",
    "revision": null
  }, {
    "url": "assets/html2canvas.esm-QH1iLAAe.js",
    "revision": null
  }, {
    "url": "assets/dialog-DZ0kzDgf.js",
    "revision": null
  }, {
    "url": "assets/dateUtils-ZG2AB3Sa.js",
    "revision": null
  }, {
    "url": "assets/constants-3JJP6fUD.js",
    "revision": null
  }, {
    "url": "assets/card-CfyCm5FT.js",
    "revision": null
  }, {
    "url": "assets/badge-Dg0Wr9OW.js",
    "revision": null
  }, {
    "url": "assets/audit-BJrWzGUH.js",
    "revision": null
  }, {
    "url": "assets/Settings-DroOG8Ue.js",
    "revision": null
  }, {
    "url": "assets/Services-BRDoyue6.js",
    "revision": null
  }, {
    "url": "assets/Reports-D3EpOe23.js",
    "revision": null
  }, {
    "url": "assets/Records-DqOvzt5E.js",
    "revision": null
  }, {
    "url": "assets/Radiology-Cjd3K3Np.js",
    "revision": null
  }, {
    "url": "assets/Profile-B6A82TOR.js",
    "revision": null
  }, {
    "url": "assets/Pharmacy-DB7tt7FL.js",
    "revision": null
  }, {
    "url": "assets/Patients-Df69R-Lo.js",
    "revision": null
  }, {
    "url": "assets/Messages-DiGsB7yZ.js",
    "revision": null
  }, {
    "url": "assets/Login-BZR1OdHt.js",
    "revision": null
  }, {
    "url": "assets/Lab-DyP67U46.js",
    "revision": null
  }, {
    "url": "assets/HR-DCz1f77I.js",
    "revision": null
  }, {
    "url": "assets/Doctors-vy_dL8_Y.js",
    "revision": null
  }, {
    "url": "assets/Dashboard-DgX-1fsY.js",
    "revision": null
  }, {
    "url": "assets/Dashboard-CU_l8foJ.js",
    "revision": null
  }, {
    "url": "assets/Clinic-Clp3ptq5.js",
    "revision": null
  }, {
    "url": "assets/CSPContext-ON1TvfDk.js",
    "revision": null
  }, {
    "url": "assets/Billing-CVSiv1Nn.js",
    "revision": null
  }, {
    "url": "assets/BarcodeScanner-CGN1ZdWO.js",
    "revision": null
  }, {
    "url": "assets/AuditLogs-PvO-VKt2.js",
    "revision": null
  }, {
    "url": "assets/Appointments-CHox9b_V.js",
    "revision": null
  }, {
    "url": "assets/Appointments-C2QOK-uK.js",
    "revision": null
  }, {
    "url": "manifest.webmanifest",
    "revision": "f05599f987be3f8719fcd2ce65e31e23"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 203]
    })]
  }), 'GET');

}));
