import { DiagnosticSeverity } from '@stoplight/types';
import { cloneDeep } from 'lodash';
import { HumanReadableDiagnosticSeverity, Rule } from '../../types';
import { FileRule, FileRuleCollection, FileRulesetSeverity } from '../../types/ruleset';
import { DEFAULT_SEVERITY_LEVEL, getDiagnosticSeverity, getSeverityLevel } from '../severity';
import { isValidRule } from '../validation';

/*
- if rule is object, simple deep merge (or we could replace to be a bit stricter?)
- if rule is true, use parent rule with it's default severity
- if rule is false, use parent rule but set it's severity to "off"
- if rule is string or number, use parent rule and set it's severity to the given string/number value
- if rule is array, index 0 should be false/true/string/number - same severity logic as above. optional second
*/
export function mergeRules(
  target: FileRuleCollection,
  source: FileRuleCollection,
  rulesetSeverity?: FileRulesetSeverity,
): FileRuleCollection {
  for (const [name, rule] of Object.entries(source)) {
    if (rulesetSeverity !== undefined) {
      const severity = getSeverityLevel(source, name, rulesetSeverity);
      if (isValidRule(rule)) {
        markRule(rule);
        rule.severity = severity;
        processRule(target, name, rule);
      } else {
        processRule(target, name, typeof rule === 'boolean' ? rule : severity);
      }
    } else {
      processRule(target, name, rule);
    }
  }

  return target;
}

const ROOT_DESCRIPTOR = Symbol('root-descriptor');

function markRule(rule: Rule) {
  if (!(ROOT_DESCRIPTOR in rule)) {
    Object.defineProperty(rule, ROOT_DESCRIPTOR, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: copyRule(rule),
    });
  }
}

function updateRootRule(root: Rule, newRule: Rule | null) {
  markRule(root);
  Object.assign(root[ROOT_DESCRIPTOR], copyRule(newRule === null ? root : Object.assign(root, newRule)));
}

function getRootRule(rule: Rule): Rule {
  return rule[ROOT_DESCRIPTOR] !== undefined ? rule[ROOT_DESCRIPTOR] : null;
}

function copyRule(rule: Rule) {
  return cloneDeep(rule);
}

function processRule(rules: FileRuleCollection, name: string, rule: FileRule | FileRulesetSeverity) {
  const existingRule = rules[name];

  switch (typeof rule) {
    case 'boolean':
      if (isValidRule(existingRule)) {
        const rootRule = getRootRule(existingRule);
        if (rule) {
          existingRule.severity = rootRule ? rootRule.severity : getSeverityLevel(rules, name, rule);
          updateRootRule(existingRule, existingRule);
        } else {
          existingRule.severity = -1;
        }
      }
      break;
    case 'string':
    case 'number':
      // what if rule does not exist (yet)? throw, store the invalid state somehow?
      if (isValidRule(existingRule)) {
        existingRule.severity = getSeverityLevel(rules, name, rule);
      }

      break;
    case 'object':
      if (Array.isArray(rule)) {
        processRule(rules, name, rule[0]);

        if (isValidRule(existingRule) && rule.length === 2 && rule[1] !== undefined) {
          if ('functionOptions' in existingRule.then) {
            existingRule.then.functionOptions = rule[1];
          }

          updateRootRule(existingRule, null);
        }
      } else if (isValidRule(existingRule)) {
        normalizeRule(rule, existingRule.severity);
        updateRootRule(existingRule, rule);
      } else {
        normalizeRule(rule, getSeverityLevel(rules, name, rule));
        // new rule
        markRule(rule);
        rules[name] = rule;
      }

      break;
    default:
      throw new Error('Invalid value for a rule');
  }
}

function normalizeRule(rule: Rule, severity: DiagnosticSeverity | HumanReadableDiagnosticSeverity | undefined) {
  if (rule.severity === void 0) {
    rule.severity = severity === void 0 ? (rule.recommended ? DEFAULT_SEVERITY_LEVEL : -1) : severity;
  } else {
    rule.severity = getDiagnosticSeverity(rule.severity);
  }
}
