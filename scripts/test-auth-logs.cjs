const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

async function main() {
  const secret = 'DO_NOT_LOG_TOKEN_CODE_SUBJECT_OR_ERROR_DETAILS';
  for (const file of ['app/page.tsx', 'app/auth/redirect/page.tsx', 'app/patient/emergency-capsule/page.tsx']) {
    for (const initError of [null, new Error(secret)]) {
      const logs = [], effects = [];
      const auth = {
        authenticated: false, isInitializing: false, initError,
        login: () => Promise.reject(new Error(secret)),
        hasRealmRole: () => false, hasClientRole: () => false,
        getValueFromToken: () => secret,
        persona: { id: 'patient_an', name: 'Test', role: 'PATIENT', realmRoles: [] },
        allPersonas: [],
        switchPersona: () => {},
      };
      const jsx = (type, props) => ({ type, props });
      const modules = {
        react: { useCallback: fn => fn, useEffect: fn => effects.push(fn), useState: value => [value, () => {}] },
        'react/jsx-runtime': { jsx, jsxs: jsx },
        '@tidecloak/nextjs': { useTideCloak: () => auth },
        '../lib/auth/tidecloak-simulator': { useHealthcareAuth: () => auth, useTideCloak: () => auth, TIDE_PERSONAS: {} },
        '../../lib/auth/tidecloak-simulator': { useHealthcareAuth: () => auth, useTideCloak: () => auth, TIDE_PERSONAS: {} },
        '../../../lib/auth/tidecloak-simulator': { useHealthcareAuth: () => auth, useTideCloak: () => auth, TIDE_PERSONAS: {} },
        'next/navigation': { useRouter: () => ({ push() {} }) },
        'next/link': { default: 'a' },
      };
      const exports = {};
      const code = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
      }).outputText;
      runInNewContext(code, {
        exports, require: name => { assert(name in modules, name); return modules[name]; },
        console: Object.fromEntries(['log', 'warn', 'error'].map(method => [method, (...args) => logs.push(args)])),
        URLSearchParams,
        window: { location: { search: '', hash: `#code=${secret}&state=${secret}&error=${secret}&error_description=${secret}` } },
      });
      const tree = exports.default();
      for (const effect of effects) effect();
      function clickLogin(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(clickLogin);
        if (node.type === 'button') node.props.onClick();
        else clickLogin(node.props?.children);
      }
      clickLogin(tree);
      await Promise.resolve();
      assert(logs.length > 0, `${file}: missing diagnostics`);
      assert(!JSON.stringify(logs).includes(secret), `${file}: sensitive data leaked`);
      if (file.includes('/redirect/')) {
        const received = logs.find(([event]) => event === '[auth-debug] callback:received')[1];
        assert(received.hasCode && received.hasState && received.hasOAuthError && received.hasErrorDescription);
      }
    }
  }
  console.log('PASS auth diagnostics: login failures and callback flags logged without sensitive values');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
