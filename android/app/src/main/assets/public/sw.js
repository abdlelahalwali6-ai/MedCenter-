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
    "revision": "c2c09d03070c521709f0b5922218d846"
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
    "url": "assets/vendor-firebase-CAFwYYEf.js",
    "revision": null
  }, {
    "url": "assets/vendor-db-qlHQlgqb.js",
    "revision": null
  }, {
    "url": "assets/vendor-charts-QSlfisd8.js",
    "revision": null
  }, {
    "url": "assets/useCompositeListItem-BZ3gGLGt.js",
    "revision": null
  }, {
    "url": "assets/textarea-ynMcmBvw.js",
    "revision": null
  }, {
    "url": "assets/tabs-C3FtN5xO.js",
    "revision": null
  }, {
    "url": "assets/table-CAODndMi.js",
    "revision": null
  }, {
    "url": "assets/select-CeR7bnVh.js",
    "revision": null
  }, {
    "url": "assets/scroll-area-D-RhUgzz.js",
    "revision": null
  }, {
    "url": "assets/react-barcode-DySeKCT-.js",
    "revision": null
  }, {
    "url": "assets/purify.es-B5CD4DQe.js",
    "revision": null
  }, {
    "url": "assets/proxy-BQemBZfQ.js",
    "revision": null
  }, {
    "url": "assets/label-B7cZtqr_.js",
    "revision": null
  }, {
    "url": "assets/index.es-BMFEhA_8.js",
    "revision": null
  }, {
    "url": "assets/index-DKpf6rFO.css",
    "revision": null
  }, {
    "url": "assets/index-CceueNc7.js",
    "revision": null
  }, {
    "url": "assets/html2canvas.esm-QH1iLAAe.js",
    "revision": null
  }, {
    "url": "assets/dialog-CMhThjU6.js",
    "revision": null
  }, {
    "url": "assets/dateUtils-C5l4hMhX.js",
    "revision": null
  }, {
    "url": "assets/dataService-CQ3ymhTO.js",
    "revision": null
  }, {
    "url": "assets/constants-3JJP6fUD.js",
    "revision": null
  }, {
    "url": "assets/card-D1TmAPZE.js",
    "revision": null
  }, {
    "url": "assets/badge-DAJCk6hE.js",
    "revision": null
  }, {
    "url": "assets/audit-CSqVtFHp.js",
    "revision": null
  }, {
    "url": "assets/Settings-BnN-YtEQ.js",
    "revision": null
  }, {
    "url": "assets/Services-DfCmFoMd.js",
    "revision": null
  }, {
    "url": "assets/Reports-CPGmhCtY.js",
    "revision": null
  }, {
    "url": "assets/Records-QEdDIQ_H.js",
    "revision": null
  }, {
    "url": "assets/Radiology-_OHMqXOx.js",
    "revision": null
  }, {
    "url": "assets/Profile-TjniM65_.js",
    "revision": null
  }, {
    "url": "assets/Pharmacy-BOPQ75i9.js",
    "revision": null
  }, {
    "url": "assets/Patients-iK_qXwqH.js",
    "revision": null
  }, {
    "url": "assets/Messages-DZGFpvCW.js",
    "revision": null
  }, {
    "url": "assets/Login-LXttJBc7.js",
    "revision": null
  }, {
    "url": "assets/Lab-0JSnSUvS.js",
    "revision": null
  }, {
    "url": "assets/HR-D6eOzxUn.js",
    "revision": null
  }, {
    "url": "assets/Doctors-PoxCMsXr.js",
    "revision": null
  }, {
    "url": "assets/Dashboard-BZZ756tL.js",
    "revision": null
  }, {
    "url": "assets/Dashboard-BNu-grEB.js",
    "revision": null
  }, {
    "url": "assets/Clinic-CJmFSqLc.js",
    "revision": null
  }, {
    "url": "assets/CSPContext-BOTUEiJi.js",
    "revision": null
  }, {
    "url": "assets/Billing-CTF0_mGn.js",
    "revision": null
  }, {
    "url": "assets/BarcodeScanner-CCibtlZa.js",
    "revision": null
  }, {
    "url": "assets/AuditLogs-CzTZZ-Ut.js",
    "revision": null
  }, {
    "url": "assets/Appointments-Cf73a1FW.js",
    "revision": null
  }, {
    "url": "assets/Appointments-CFFSlZTj.js",
    "revision": null
  }, {
    "url": "manifest.webmanifest",
    "revision": "e79345eab6a79271724341d8c45c03d6"
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
