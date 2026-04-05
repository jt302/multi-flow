use std::collections::HashMap;

use serde_json::Value;

/// 运行时变量存储，支持 `{{key}}` 插值
#[derive(Clone)]
pub struct RunVariables {
    vars: HashMap<String, String>,
}

impl RunVariables {
    pub fn new() -> Self {
        Self {
            vars: HashMap::new(),
        }
    }

    pub fn set(&mut self, key: &str, value: String) {
        self.vars.insert(key.to_string(), value);
    }

    pub fn get(&self, key: &str) -> Option<&str> {
        self.vars.get(key).map(|s| s.as_str())
    }

    /// 将字符串中的 `{{key}}` 替换为对应变量值，未命中时保持原样
    pub fn interpolate(&self, template: &str) -> String {
        if !template.contains("{{") {
            return template.to_string();
        }
        let mut result = template.to_string();
        for (key, value) in &self.vars {
            let placeholder = format!("{{{{{key}}}}}");
            result = result.replace(&placeholder, value);
        }
        result
    }

    /// 递归替换 JSON Value 中所有字符串叶节点的 `{{key}}`
    pub fn interpolate_value(&self, value: &Value) -> Value {
        match value {
            Value::String(s) => Value::String(self.interpolate(s)),
            Value::Array(arr) => {
                Value::Array(arr.iter().map(|v| self.interpolate_value(v)).collect())
            }
            Value::Object(map) => {
                let new_map = map
                    .iter()
                    .map(|(k, v)| (k.clone(), self.interpolate_value(v)))
                    .collect();
                Value::Object(new_map)
            }
            other => other.clone(),
        }
    }

    /// 简单比较表达式求值，支持 `{{a}} == "val"`, `{{a}} != "val"`, `{{a}} > 0` 等
    /// 不支持复杂逻辑表达式，仅用于 Condition 步骤的基础判断
    pub fn eval_condition(&self, expr: &str) -> bool {
        let expr = self.interpolate(expr.trim());
        // 尝试 ==
        if let Some((left, right)) = split_op(&expr, "==") {
            return left == right;
        }
        if let Some((left, right)) = split_op(&expr, "!=") {
            return left != right;
        }
        if let Some((left, right)) = split_op(&expr, ">=") {
            return cmp_numeric(&left, &right, |a, b| a >= b);
        }
        if let Some((left, right)) = split_op(&expr, "<=") {
            return cmp_numeric(&left, &right, |a, b| a <= b);
        }
        if let Some((left, right)) = split_op(&expr, ">") {
            return cmp_numeric(&left, &right, |a, b| a > b);
        }
        if let Some((left, right)) = split_op(&expr, "<") {
            return cmp_numeric(&left, &right, |a, b| a < b);
        }
        // 裸值：非空且非 "false"/"0" 视为 true
        !expr.is_empty() && expr != "false" && expr != "0"
    }

    /// 返回当前变量快照
    pub fn snapshot(&self) -> HashMap<String, String> {
        self.vars.clone()
    }
}

fn split_op<'a>(expr: &'a str, op: &str) -> Option<(String, String)> {
    let pos = expr.find(op)?;
    // 确保不是更长运算符的子串（如 > 不误匹配 >=）
    let next_char = expr[pos + op.len()..].chars().next();
    if op == ">" && next_char == Some('=') {
        return None;
    }
    if op == "<" && next_char == Some('=') {
        return None;
    }
    if op == "=" && next_char == Some('=') {
        // 单个 = 不处理
        return None;
    }
    let left = expr[..pos].trim().trim_matches('"').to_string();
    let right = expr[pos + op.len()..].trim().trim_matches('"').to_string();
    Some((left, right))
}

fn cmp_numeric(left: &str, right: &str, f: impl Fn(f64, f64) -> bool) -> bool {
    if let (Ok(a), Ok(b)) = (left.parse::<f64>(), right.parse::<f64>()) {
        f(a, b)
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn interpolate_basic() {
        let mut vars = RunVariables::new();
        vars.set("name", "world".to_string());
        assert_eq!(vars.interpolate("hello {{name}}"), "hello world");
    }

    #[test]
    fn interpolate_no_match_kept() {
        let vars = RunVariables::new();
        assert_eq!(vars.interpolate("{{missing}}"), "{{missing}}");
    }

    #[test]
    fn interpolate_value_recursive() {
        let mut vars = RunVariables::new();
        vars.set("url", "https://example.com".to_string());
        let v = json!({ "navigate": { "url": "{{url}}" } });
        let result = vars.interpolate_value(&v);
        assert_eq!(result["navigate"]["url"], "https://example.com");
    }

    #[test]
    fn eval_condition_eq() {
        let mut vars = RunVariables::new();
        vars.set("status", "ok".to_string());
        assert!(vars.eval_condition(r#"{{status}} == "ok""#));
        assert!(!vars.eval_condition(r#"{{status}} == "fail""#));
    }

    #[test]
    fn eval_condition_numeric() {
        let mut vars = RunVariables::new();
        vars.set("count", "5".to_string());
        assert!(vars.eval_condition("{{count}} > 3"));
        assert!(!vars.eval_condition("{{count}} > 10"));
    }
}
