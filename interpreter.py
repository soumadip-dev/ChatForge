#!/usr/bin/env python3
"""
A JavaScript interpreter written in Python.
Supports a substantial subset of ES6+ JavaScript:
 - let/const/var declarations
 - numbers, strings, booleans, null, undefined
 - arrays, objects, functions (declarations, expressions, arrow functions)
 - arithmetic / comparison / logical / assignment operators (incl. compound, ++/--)
 - if/else if/else, switch/case
 - for, while, do-while, for-of, for-in
 - array methods: push, pop, shift, unshift, slice, splice, concat, includes,
   indexOf, sort, reverse, join, map, filter, reduce, find, some, every, forEach
 - string methods: replace, replaceAll, substring, slice, split, trim,
   toUpperCase, toLowerCase, includes, startsWith, endsWith, indexOf, charAt,
   padStart, padEnd, repeat, concat, trimStart, trimEnd
 - Math object (floor, ceil, round, abs, pow, sqrt, max, min, random, PI, E, ...)
 - basic Date object
 - typeof, spread/rest operators, template literals, destructuring (basic)
 - JSON.stringify / JSON.parse
"""

import sys
import re
import math
import random
import time as _time
import threading


# ============================================================
# Lexer
# ============================================================

KEYWORDS = {
    'let', 'const', 'var', 'function', 'return', 'if', 'else', 'while', 'for',
    'do', 'switch', 'case', 'default', 'break', 'continue', 'true', 'false',
    'null', 'undefined', 'new', 'typeof', 'of', 'in', 'this', 'delete', 'void',
    'instanceof', 'class', 'extends', 'super', 'try', 'catch', 'finally', 'throw'
}

TOKEN_SPEC = [
    ('WS', r'[ \t\r\n]+'),
    ('COMMENT_BLOCK', r'/\*.*?\*/'),
    ('COMMENT_LINE', r'//[^\n]*'),
    ('NUMBER', r'0[xX][0-9a-fA-F]+|\d+\.\d+|\.\d+|\d+'),
    ('STRING', r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\''),
    ('TEMPLATE', r'`(?:\\.|[^`\\])*`'),
    ('IDENT', r'[A-Za-z_$][A-Za-z0-9_$]*'),
    ('OP', r'\?\?=|\?\.|\.\.\.|===|!==|<<=|>>=|>>>|\*\*=|&&=|\|\|=|\?\?|=>'
           r'|<=|>=|==|!=|&&|\|\||\+\+|--|\+=|-=|\*=|/=|%=|\*\*'
           r'|[-+*/%<>=!&|^~?:.,;(){}\[\]]'),
]

MASTER_PAT = re.compile('|'.join('(?P<%s>%s)' % p for p in TOKEN_SPEC), re.DOTALL)

REGEX_PAT = re.compile(r'/(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\\n])+/[gimsuy]*')


class Token:
    __slots__ = ('type', 'value', 'pos')

    def __init__(self, type_, value, pos):
        self.type = type_
        self.value = value
        self.pos = pos

    def __repr__(self):
        return f'Token({self.type!r}, {self.value!r})'


def decode_string_literal(raw):
    """raw includes the surrounding quote chars"""
    quote = raw[0]
    body = raw[1:-1]
    return decode_escapes(body)


def decode_escapes(body):
    out = []
    i = 0
    n = len(body)
    while i < n:
        c = body[i]
        if c == '\\' and i + 1 < n:
            nxt = body[i + 1]
            mapping = {
                'n': '\n', 't': '\t', 'r': '\r', 'b': '\b', 'f': '\f',
                'v': '\v', '0': '\0', '\\': '\\', "'": "'", '"': '"',
                '`': '`', '\n': '', '$': '$',
            }
            if nxt in mapping:
                out.append(mapping[nxt])
                i += 2
                continue
            elif nxt == 'u':
                # \uXXXX or \u{XXXXXX}
                if i + 2 < n and body[i + 2] == '{':
                    end = body.index('}', i + 3)
                    code = int(body[i + 3:end], 16)
                    out.append(chr(code))
                    i = end + 1
                    continue
                else:
                    code = int(body[i + 2:i + 6], 16)
                    out.append(chr(code))
                    i += 6
                    continue
            elif nxt == 'x':
                code = int(body[i + 2:i + 4], 16)
                out.append(chr(code))
                i += 4
                continue
            else:
                out.append(nxt)
                i += 2
                continue
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def tokenize(src):
    tokens = []
    pos = 0
    n = len(src)
    while pos < n:
        # Check if it's a regex literal
        if src[pos] == '/' and src[pos:pos+2] not in ('//', '/*'):
            last_tok = tokens[-1] if tokens else None
            is_op = False
            if last_tok:
                if last_tok.type in ('IDENT', 'NUMBER', 'STRING', 'TEMPLATE'):
                    is_op = True
                elif last_tok.type == 'KEYWORD' and last_tok.value in ('this', 'true', 'false', 'null', 'undefined', 'super'):
                    is_op = True
                elif last_tok.type == 'OP' and last_tok.value in (')', ']', '}', '++', '--'):
                    is_op = True
            
            if not is_op:
                m_re = REGEX_PAT.match(src, pos)
                if m_re:
                    val = m_re.group()
                    tokens.append(Token('REGEX', val, pos))
                    pos = m_re.end()
                    continue

        m = MASTER_PAT.match(src, pos)
        if not m:
            raise SyntaxError(f'Unexpected character {src[pos]!r} at {pos}')
        kind = m.lastgroup
        val = m.group()
        if kind in ('WS', 'COMMENT_BLOCK', 'COMMENT_LINE'):
            pos = m.end()
            continue
        if kind == 'IDENT' and val in KEYWORDS:
            kind = 'KEYWORD'
        tokens.append(Token(kind, val, pos))
        pos = m.end()
    tokens.append(Token('EOF', None, pos))
    return tokens


# ============================================================
# Parser  (recursive descent, produces AST as nested dicts)
# ============================================================

ASSIGN_OPS = {'=', '+=', '-=', '*=', '/=', '%=', '**=', '&&=', '||=', '??='}

BIN_PRECEDENCE = {
    '??': 1,
    '||': 2,
    '&&': 3,
    '|': 4,
    '^': 5,
    '&': 6,
    '==': 7, '!=': 7, '===': 7, '!==': 7,
    '<': 8, '>': 8, '<=': 8, '>=': 8, 'instanceof': 8, 'in': 8,
    '+': 9, '-': 9,
    '*': 10, '/': 10, '%': 10,
    '**': 11,
}
RIGHT_ASSOC = {'**'}


class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    # ---- helpers ----
    def cur(self):
        return self.tokens[self.pos]

    def peek(self, offset=1):
        idx = self.pos + offset
        if idx < len(self.tokens):
            return self.tokens[idx]
        return self.tokens[-1]

    def advance(self):
        tok = self.tokens[self.pos]
        self.pos += 1
        return tok

    def check(self, type_, value=None):
        tok = self.cur()
        if tok.type != type_:
            return False
        if value is not None and tok.value != value:
            return False
        return True

    def check_val(self, value):
        return self.cur().value == value

    def expect(self, type_, value=None):
        tok = self.cur()
        if tok.type != type_ or (value is not None and tok.value != value):
            raise SyntaxError(f'Expected {type_} {value!r} but got {tok.type} {tok.value!r} at pos {tok.pos}')
        return self.advance()

    def expect_val(self, value):
        tok = self.cur()
        if tok.value != value:
            raise SyntaxError(f'Expected {value!r} but got {tok.value!r} at pos {tok.pos}')
        return self.advance()

    def at_end(self):
        return self.cur().type == 'EOF'

    def skip_semicolons(self):
        while self.check('OP', ';'):
            self.advance()

    # ---- program ----
    def parse_program(self):
        body = []
        self.skip_semicolons()
        while not self.at_end():
            body.append(self.parse_statement())
            self.skip_semicolons()
        return {'type': 'Program', 'body': body}

    # ---- statements ----
    def parse_statement(self):
        tok = self.cur()
        if tok.type == 'IDENT' and self.peek().type == 'OP' and self.peek().value == ':':
            label_name = self.advance().value
            self.advance()  # skip ':'
            body = self.parse_statement()
            return {'type': 'LabeledStatement', 'label': {'type': 'Identifier', 'name': label_name}, 'body': body}
        if tok.type == 'KEYWORD':
            if tok.value in ('let', 'const', 'var'):
                node = self.parse_variable_declaration()
                self.skip_semicolons()
                return node
            if tok.value == 'function':
                return self.parse_function_declaration()
            if tok.value == 'if':
                return self.parse_if_statement()
            if tok.value == 'for':
                return self.parse_for_statement()
            if tok.value == 'while':
                return self.parse_while_statement()
            if tok.value == 'do':
                return self.parse_do_while_statement()
            if tok.value == 'return':
                self.advance()
                arg = None
                if not (self.check('OP', ';') or self.check('OP', '}') or self.at_end()
                        or tok.pos != self.cur().pos and self._newline_between_return(tok)):
                    if not self.check('OP', ';') and not self.check('OP', '}'):
                        arg = self.parse_expression()
                self.skip_semicolons()
                return {'type': 'ReturnStatement', 'argument': arg}
            if tok.value == 'break':
                self.advance()
                label = None
                if self.cur().type == 'IDENT':
                    label = {'type': 'Identifier', 'name': self.advance().value}
                self.skip_semicolons()
                return {'type': 'BreakStatement', 'label': label}
            if tok.value == 'continue':
                self.advance()
                label = None
                if self.cur().type == 'IDENT':
                    label = {'type': 'Identifier', 'name': self.advance().value}
                self.skip_semicolons()
                return {'type': 'ContinueStatement', 'label': label}
            if tok.value == 'switch':
                return self.parse_switch_statement()
            if tok.value == 'try':
                return self.parse_try_statement()
            if tok.value == 'throw':
                self.advance()
                arg = self.parse_expression()
                self.skip_semicolons()
                return {'type': 'ThrowStatement', 'argument': arg}
            if tok.value == 'class':
                return self.parse_class_declaration()
        if tok.type == 'OP' and tok.value == '{':
            return self.parse_block_statement()
        if tok.type == 'OP' and tok.value == ';':
            self.advance()
            return {'type': 'EmptyStatement'}
        # expression statement
        expr = self.parse_expression()
        self.skip_semicolons()
        return {'type': 'ExpressionStatement', 'expression': expr}

    def _newline_between_return(self, tok):
        return False

    def parse_block_statement(self):
        self.expect_val('{')
        body = []
        self.skip_semicolons()
        while not self.check('OP', '}'):
            body.append(self.parse_statement())
            self.skip_semicolons()
        self.expect_val('}')
        return {'type': 'BlockStatement', 'body': body}

    def parse_variable_declaration(self):
        kind = self.advance().value  # let/const/var
        decls = []
        while True:
            target = self.parse_binding_target()
            init = None
            if self.check('OP', '='):
                self.advance()
                init = self.parse_assignment_expr()
            decls.append({'id': target, 'init': init})
            if self.check('OP', ','):
                self.advance()
                continue
            break
        return {'type': 'VariableDeclaration', 'kind': kind, 'declarations': decls}

    def parse_binding_target(self):
        # identifier, array pattern, or object pattern
        if self.check('OP', '['):
            return self.parse_array_pattern()
        if self.check('OP', '{'):
            return self.parse_object_pattern()
        name = self.expect('IDENT').value
        return {'type': 'Identifier', 'name': name}

    def parse_array_pattern(self):
        self.expect_val('[')
        elements = []
        while not self.check('OP', ']'):
            if self.check('OP', ','):
                elements.append(None)
                self.advance()
                continue
            if self.check('OP', '...'):
                self.advance()
                elements.append({'type': 'RestElement', 'argument': self.parse_binding_target()})
            else:
                target = self.parse_binding_target()
                if self.check('OP', '='):
                    self.advance()
                    default = self.parse_assignment_expr()
                    target = {'type': 'AssignmentPattern', 'left': target, 'right': default}
                elements.append(target)
            if self.check('OP', ','):
                self.advance()
        self.expect_val(']')
        return {'type': 'ArrayPattern', 'elements': elements}

    def parse_object_pattern(self):
        self.expect_val('{')
        props = []
        while not self.check('OP', '}'):
            if self.check('OP', '...'):
                self.advance()
                props.append({'type': 'RestElement', 'argument': self.parse_binding_target()})
            else:
                computed = False
                if self.check('OP', '['):
                    self.advance()
                    key = self.parse_assignment_expr()
                    self.expect_val(']')
                    computed = True
                else:
                    keytok = self.advance()
                    key = {'type': 'Identifier', 'name': keytok.value} if keytok.type != 'STRING' else {'type': 'StringLiteral', 'value': decode_string_literal(keytok.value)}
                if self.check('OP', ':'):
                    self.advance()
                    value = self.parse_binding_target()
                else:
                    value = {'type': 'Identifier', 'name': key['name']}
                if self.check('OP', '='):
                    self.advance()
                    default = self.parse_assignment_expr()
                    value = {'type': 'AssignmentPattern', 'left': value, 'right': default}
                props.append({'key': key, 'value': value, 'computed': computed})
            if self.check('OP', ','):
                self.advance()
        self.expect_val('}')
        return {'type': 'ObjectPattern', 'properties': props}

    def parse_function_declaration(self):
        self.expect_val('function')
        name = self.expect('IDENT').value
        params = self.parse_params()
        body = self.parse_block_statement()
        return {'type': 'FunctionDeclaration', 'name': name, 'params': params, 'body': body}

    def parse_params(self):
        self.expect_val('(')
        params = []
        while not self.check('OP', ')'):
            if self.check('OP', '...'):
                self.advance()
                params.append({'type': 'RestElement', 'argument': self.parse_binding_target()})
            else:
                target = self.parse_binding_target()
                if self.check('OP', '='):
                    self.advance()
                    default = self.parse_assignment_expr()
                    target = {'type': 'AssignmentPattern', 'left': target, 'right': default}
                params.append(target)
            if self.check('OP', ','):
                self.advance()
        self.expect_val(')')
        return params

    def parse_if_statement(self):
        self.expect_val('if')
        self.expect_val('(')
        test = self.parse_expression()
        self.expect_val(')')
        consequent = self.parse_statement()
        alternate = None
        if self.check('KEYWORD', 'else'):
            self.advance()
            alternate = self.parse_statement()
        return {'type': 'IfStatement', 'test': test, 'consequent': consequent, 'alternate': alternate}

    def parse_for_statement(self):
        self.expect_val('for')
        self.expect_val('(')
        # detect for-of / for-in
        init = None
        if self.check('OP', ';'):
            pass
        elif self.check('KEYWORD', 'let') or self.check('KEYWORD', 'const') or self.check('KEYWORD', 'var'):
            kind = self.advance().value
            target = self.parse_binding_target()
            if self.check('KEYWORD', 'of') or self.check('KEYWORD', 'in'):
                kindword = self.advance().value
                right = self.parse_assignment_expr() if kindword == 'of' else self.parse_expression()
                self.expect_val(')')
                body = self.parse_statement()
                left = {'type': 'VariableDeclaration', 'kind': kind, 'declarations': [{'id': target, 'init': None}]}
                ntype = 'ForOfStatement' if kindword == 'of' else 'ForInStatement'
                return {'type': ntype, 'left': left, 'right': right, 'body': body}
            else:
                decls = [{'id': target, 'init': None}]
                if self.check('OP', '='):
                    self.advance()
                    decls[0]['init'] = self.parse_assignment_expr()
                while self.check('OP', ','):
                    self.advance()
                    t2 = self.parse_binding_target()
                    init2 = None
                    if self.check('OP', '='):
                        self.advance()
                        init2 = self.parse_assignment_expr()
                    decls.append({'id': t2, 'init': init2})
                init = {'type': 'VariableDeclaration', 'kind': kind, 'declarations': decls}
        else:
            expr = self.parse_expression()
            if self.check('KEYWORD', 'of') or self.check('KEYWORD', 'in'):
                kindword = self.advance().value
                right = self.parse_assignment_expr() if kindword == 'of' else self.parse_expression()
                self.expect_val(')')
                body = self.parse_statement()
                ntype = 'ForOfStatement' if kindword == 'of' else 'ForInStatement'
                return {'type': ntype, 'left': expr, 'right': right, 'body': body}
            init = {'type': 'ExpressionStatement', 'expression': expr}
        self.expect_val(';')
        test = None
        if not self.check('OP', ';'):
            test = self.parse_expression()
        self.expect_val(';')
        update = None
        if not self.check('OP', ')'):
            update = self.parse_expression()
        self.expect_val(')')
        body = self.parse_statement()
        return {'type': 'ForStatement', 'init': init, 'test': test, 'update': update, 'body': body}

    def parse_while_statement(self):
        self.expect_val('while')
        self.expect_val('(')
        test = self.parse_expression()
        self.expect_val(')')
        body = self.parse_statement()
        return {'type': 'WhileStatement', 'test': test, 'body': body}

    def parse_do_while_statement(self):
        self.expect_val('do')
        body = self.parse_statement()
        self.expect_val('while')
        self.expect_val('(')
        test = self.parse_expression()
        self.expect_val(')')
        self.skip_semicolons()
        return {'type': 'DoWhileStatement', 'body': body, 'test': test}

    def parse_switch_statement(self):
        self.expect_val('switch')
        self.expect_val('(')
        disc = self.parse_expression()
        self.expect_val(')')
        self.expect_val('{')
        cases = []
        while not self.check('OP', '}'):
            if self.check('KEYWORD', 'case'):
                self.advance()
                test = self.parse_expression()
                self.expect_val(':')
            else:
                self.expect('KEYWORD', 'default')
                self.expect_val(':')
                test = None
            consequent = []
            while not (self.check('KEYWORD', 'case') or self.check('KEYWORD', 'default') or self.check('OP', '}')):
                consequent.append(self.parse_statement())
                self.skip_semicolons()
            cases.append({'test': test, 'consequent': consequent})
        self.expect_val('}')
        return {'type': 'SwitchStatement', 'discriminant': disc, 'cases': cases}

    def parse_try_statement(self):
        self.expect_val('try')
        block = self.parse_block_statement()
        handler = None
        finalizer = None
        if self.check('KEYWORD', 'catch'):
            self.advance()
            param = None
            if self.check('OP', '('):
                self.advance()
                param = self.parse_binding_target()
                self.expect_val(')')
            cbody = self.parse_block_statement()
            handler = {'param': param, 'body': cbody}
        if self.check('KEYWORD', 'finally'):
            self.advance()
            finalizer = self.parse_block_statement()
        return {'type': 'TryStatement', 'block': block, 'handler': handler, 'finalizer': finalizer}

    def parse_class_declaration(self):
        self.expect_val('class')
        name = self.expect('IDENT').value
        superclass = None
        if self.check('KEYWORD', 'extends'):
            self.advance()
            superclass = self.parse_lhs_expr()
        self.expect_val('{')
        body = []
        while not self.check('OP', '}'):
            if self.check('OP', ';'):
                self.advance()
                continue
            is_static = False
            if self.check('IDENT', 'static'):
                self.advance()
                is_static = True
            mname_tok = self.advance()
            mname = mname_tok.value
            params = self.parse_params()
            mbody = self.parse_block_statement()
            kind = 'constructor' if mname == 'constructor' else 'method'
            body.append({'kind': kind, 'name': mname, 'params': params, 'body': mbody, 'static': is_static})
        self.expect_val('}')
        return {'type': 'ClassDeclaration', 'name': name, 'superclass': superclass, 'body': body}

    # ---- expressions ----
    def parse_expression(self):
        expr = self.parse_assignment_expr()
        if self.check('OP', ','):
            exprs = [expr]
            while self.check('OP', ','):
                self.advance()
                exprs.append(self.parse_assignment_expr())
            return {'type': 'SequenceExpression', 'expressions': exprs}
        return expr

    def parse_assignment_expr(self):
        # try arrow function detection first
        arrow = self.try_parse_arrow_function()
        if arrow is not None:
            return arrow
        left = self.parse_conditional_expr()
        if self.cur().type == 'OP' and self.cur().value in ASSIGN_OPS:
            op = self.advance().value
            right = self.parse_assignment_expr()
            return {'type': 'AssignmentExpression', 'operator': op, 'left': left, 'right': right}
        return left

    def try_parse_arrow_function(self):
        start = self.pos
        # case: IDENT =>
        if self.cur().type == 'IDENT' and self.peek().type == 'OP' and self.peek().value == '=>':
            param = {'type': 'Identifier', 'name': self.advance().value}
            self.advance()  # =>
            return self.finish_arrow([param])
        # case: ( ... ) =>
        if self.cur().type == 'OP' and self.cur().value == '(':
            # scan ahead to matching paren
            depth = 0
            i = self.pos
            while True:
                t = self.tokens[i]
                if t.type == 'EOF':
                    return None
                if t.type == 'OP' and t.value in ('(', '[', '{'):
                    depth += 1
                elif t.type == 'OP' and t.value in (')', ']', '}'):
                    depth -= 1
                    if depth == 0:
                        break
                i += 1
            nxt = self.tokens[i + 1]
            if nxt.type == 'OP' and nxt.value == '=>':
                params = self.parse_params()
                self.expect_val('=>')
                return self.finish_arrow(params)
            return None
        return None

    def finish_arrow(self, params):
        if self.check('OP', '{'):
            body = self.parse_block_statement()
            return {'type': 'ArrowFunctionExpression', 'params': params, 'body': body, 'expression': False}
        else:
            body = self.parse_assignment_expr()
            return {'type': 'ArrowFunctionExpression', 'params': params, 'body': body, 'expression': True}

    def parse_conditional_expr(self):
        test = self.parse_binary_expr(0)
        if self.check('OP', '?'):
            self.advance()
            cons = self.parse_assignment_expr()
            self.expect_val(':')
            alt = self.parse_assignment_expr()
            return {'type': 'ConditionalExpression', 'test': test, 'consequent': cons, 'alternate': alt}
        return test

    def parse_binary_expr(self, min_prec):
        left = self.parse_unary_expr()
        while True:
            tok = self.cur()
            op = tok.value
            if (tok.type == 'OP' and op in BIN_PRECEDENCE) or (tok.type == 'KEYWORD' and op in ('instanceof', 'in')):
                prec = BIN_PRECEDENCE[op]
                if prec < min_prec:
                    break
                next_min = prec if op in RIGHT_ASSOC else prec + 1
                self.advance()
                right = self.parse_binary_expr(next_min)
                if op in ('&&', '||', '??'):
                    left = {'type': 'LogicalExpression', 'operator': op, 'left': left, 'right': right}
                else:
                    left = {'type': 'BinaryExpression', 'operator': op, 'left': left, 'right': right}
            else:
                break
        return left

    def parse_unary_expr(self):
        tok = self.cur()
        if tok.type == 'OP' and tok.value in ('!', '-', '+', '~'):
            self.advance()
            arg = self.parse_unary_expr()
            return {'type': 'UnaryExpression', 'operator': tok.value, 'argument': arg, 'prefix': True}
        if tok.type == 'KEYWORD' and tok.value in ('typeof', 'void', 'delete'):
            self.advance()
            arg = self.parse_unary_expr()
            return {'type': 'UnaryExpression', 'operator': tok.value, 'argument': arg, 'prefix': True}
        if tok.type == 'OP' and tok.value in ('++', '--'):
            self.advance()
            arg = self.parse_unary_expr()
            return {'type': 'UpdateExpression', 'operator': tok.value, 'argument': arg, 'prefix': True}
        return self.parse_postfix_expr()

    def parse_postfix_expr(self):
        expr = self.parse_lhs_expr()
        tok = self.cur()
        if tok.type == 'OP' and tok.value in ('++', '--'):
            self.advance()
            return {'type': 'UpdateExpression', 'operator': tok.value, 'argument': expr, 'prefix': False}
        return expr

    def parse_lhs_expr(self):
        if self.check('KEYWORD', 'new'):
            self.advance()
            callee = self.parse_lhs_expr_no_call()
            args = []
            if self.check('OP', '('):
                args = self.parse_arguments()
            expr = {'type': 'NewExpression', 'callee': callee, 'arguments': args}
            return self.parse_call_tail(expr)
        expr = self.parse_primary_expr()
        return self.parse_call_tail(expr)

    def parse_lhs_expr_no_call(self):
        # parse member expression without trailing call (for `new Foo.Bar()`)
        expr = self.parse_primary_expr()
        while True:
            if self.check('OP', '.'):
                self.advance()
                prop = self.advance().value
                expr = {'type': 'MemberExpression', 'object': expr, 'property': {'type': 'Identifier', 'name': prop}, 'computed': False}
            elif self.check('OP', '['):
                self.advance()
                prop = self.parse_expression()
                self.expect_val(']')
                expr = {'type': 'MemberExpression', 'object': expr, 'property': prop, 'computed': True}
            else:
                break
        return expr

    def parse_call_tail(self, expr):
        while True:
            if self.check('OP', '.'):
                self.advance()
                prop = self.advance().value
                expr = {'type': 'MemberExpression', 'object': expr, 'property': {'type': 'Identifier', 'name': prop}, 'computed': False}
            elif self.check('OP', '?.'):
                self.advance()
                if self.check('OP', '('):
                    args = self.parse_arguments()
                    expr = {'type': 'CallExpression', 'callee': expr, 'arguments': args, 'optional': True}
                else:
                    prop = self.advance().value
                    expr = {'type': 'MemberExpression', 'object': expr, 'property': {'type': 'Identifier', 'name': prop}, 'computed': False, 'optional': True}
            elif self.check('OP', '['):
                self.advance()
                prop = self.parse_expression()
                self.expect_val(']')
                expr = {'type': 'MemberExpression', 'object': expr, 'property': prop, 'computed': True}
            elif self.check('OP', '('):
                args = self.parse_arguments()
                expr = {'type': 'CallExpression', 'callee': expr, 'arguments': args}
            else:
                break
        return expr

    def parse_arguments(self):
        self.expect_val('(')
        args = []
        while not self.check('OP', ')'):
            if self.check('OP', '...'):
                self.advance()
                args.append({'type': 'SpreadElement', 'argument': self.parse_assignment_expr()})
            else:
                args.append(self.parse_assignment_expr())
            if self.check('OP', ','):
                self.advance()
        self.expect_val(')')
        return args

    def parse_primary_expr(self):
        tok = self.cur()
        if tok.type == 'NUMBER':
            self.advance()
            if tok.value.lower().startswith('0x'):
                return {'type': 'NumericLiteral', 'value': float(int(tok.value, 16))}
            return {'type': 'NumericLiteral', 'value': float(tok.value)}
        if tok.type == 'STRING':
            self.advance()
            return {'type': 'StringLiteral', 'value': decode_string_literal(tok.value)}
        if tok.type == 'TEMPLATE':
            self.advance()
            return self.parse_template_literal(tok.value)
        if tok.type == 'REGEX':
            self.advance()
            last_slash = tok.value.rindex('/')
            pattern = tok.value[1:last_slash]
            flags = tok.value[last_slash+1:]
            return {'type': 'RegExpLiteral', 'pattern': pattern, 'flags': flags}
        if tok.type == 'KEYWORD':
            if tok.value == 'true':
                self.advance()
                return {'type': 'BooleanLiteral', 'value': True}
            if tok.value == 'false':
                self.advance()
                return {'type': 'BooleanLiteral', 'value': False}
            if tok.value == 'null':
                self.advance()
                return {'type': 'NullLiteral'}
            if tok.value == 'undefined':
                self.advance()
                return {'type': 'Identifier', 'name': 'undefined'}
            if tok.value == 'this':
                self.advance()
                return {'type': 'ThisExpression'}
            if tok.value == 'function':
                self.advance()
                name = None
                if self.cur().type == 'IDENT':
                    name = self.advance().value
                params = self.parse_params()
                body = self.parse_block_statement()
                return {'type': 'FunctionExpression', 'name': name, 'params': params, 'body': body}
            if tok.value == 'class':
                return self.parse_class_declaration()
            if tok.value in ('of', 'in', 'static'):
                self.advance()
                return {'type': 'Identifier', 'name': tok.value}
        if tok.type == 'IDENT':
            self.advance()
            return {'type': 'Identifier', 'name': tok.value}
        if tok.type == 'OP':
            if tok.value == '(':
                self.advance()
                expr = self.parse_expression()
                self.expect_val(')')
                return expr
            if tok.value == '[':
                return self.parse_array_expression()
            if tok.value == '{':
                return self.parse_object_expression()
            if tok.value == '...':
                self.advance()
                return {'type': 'SpreadElement', 'argument': self.parse_assignment_expr()}
        raise SyntaxError(f'Unexpected token {tok.type} {tok.value!r} at pos {tok.pos}')

    def parse_array_expression(self):
        self.expect_val('[')
        elements = []
        while not self.check('OP', ']'):
            if self.check('OP', ','):
                elements.append(None)
                self.advance()
                continue
            if self.check('OP', '...'):
                self.advance()
                elements.append({'type': 'SpreadElement', 'argument': self.parse_assignment_expr()})
            else:
                elements.append(self.parse_assignment_expr())
            if self.check('OP', ','):
                self.advance()
            else:
                break
        self.expect_val(']')
        return {'type': 'ArrayExpression', 'elements': elements}

    def parse_object_expression(self):
        self.expect_val('{')
        props = []
        while not self.check('OP', '}'):
            if self.check('OP', '...'):
                self.advance()
                props.append({'type': 'SpreadElement', 'argument': self.parse_assignment_expr()})
            else:
                computed = False
                is_method = False
                key = None
                if self.check('OP', '['):
                    self.advance()
                    key = self.parse_assignment_expr()
                    self.expect_val(']')
                    computed = True
                elif self.cur().type == 'STRING':
                    key = {'type': 'StringLiteral', 'value': decode_string_literal(self.advance().value)}
                elif self.cur().type == 'NUMBER':
                    key = {'type': 'StringLiteral', 'value': self.advance().value}
                else:
                    kt = self.advance()
                    key = {'type': 'Identifier', 'name': kt.value}
                if self.check('OP', '('):
                    # method shorthand
                    params = self.parse_params()
                    body = self.parse_block_statement()
                    value = {'type': 'FunctionExpression', 'name': None, 'params': params, 'body': body}
                    props.append({'key': key, 'value': value, 'computed': computed, 'shorthand': False})
                elif self.check('OP', ':'):
                    self.advance()
                    value = self.parse_assignment_expr()
                    props.append({'key': key, 'value': value, 'computed': computed, 'shorthand': False})
                else:
                    # shorthand { x }
                    value = {'type': 'Identifier', 'name': key['name']}
                    props.append({'key': key, 'value': value, 'computed': computed, 'shorthand': True})
            if self.check('OP', ','):
                self.advance()
        self.expect_val('}')
        return {'type': 'ObjectExpression', 'properties': props}

    def parse_template_literal(self, raw):
        # raw includes surrounding backticks
        body = raw[1:-1]
        quasis = []
        expressions = []
        cur_str = []
        i = 0
        n = len(body)
        while i < n:
            c = body[i]
            if c == '\\' and i + 1 < n:
                cur_str.append(decode_escapes(body[i:i + 2]))
                i += 2
                continue
            if c == '$' and i + 1 < n and body[i + 1] == '{':
                quasis.append(''.join(cur_str))
                cur_str = []
                depth = 1
                j = i + 2
                start = j
                while j < n and depth > 0:
                    if body[j] == '{':
                        depth += 1
                    elif body[j] == '}':
                        depth -= 1
                        if depth == 0:
                            break
                    elif body[j] in ('"', "'", '`'):
                        # skip nested string
                        quote = body[j]
                        j += 1
                        while j < n and body[j] != quote:
                            if body[j] == '\\':
                                j += 1
                            j += 1
                    j += 1
                expr_src = body[start:j]
                sub_tokens = tokenize(expr_src)
                sub_parser = Parser(sub_tokens)
                expressions.append(sub_parser.parse_expression())
                i = j + 1
                continue
            cur_str.append(c)
            i += 1
        quasis.append(''.join(cur_str))
        return {'type': 'TemplateLiteral', 'quasis': quasis, 'expressions': expressions}


def parse(src):
    tokens = tokenize(src)
    parser = Parser(tokens)
    return parser.parse_program()


# ============================================================
# Runtime values
# ============================================================

class JSNull:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __repr__(self):
        return 'null'


NULL = JSNull()
UNDEFINED = None  # Python None represents JS undefined


class JSRegExp(dict):
    def __init__(self, pattern, flags):
        super().__init__()
        self.pattern = pattern
        self.flags = flags
        
        py_flags = 0
        if 'i' in flags:
            py_flags |= re.IGNORECASE
        if 'm' in flags:
            py_flags |= re.MULTILINE
        if 's' in flags:
            py_flags |= re.DOTALL
            
        try:
            self.regex = re.compile(pattern, py_flags)
        except Exception:
            self.regex = re.compile(re.escape(pattern), py_flags)
            
        self['test'] = BuiltinFunction(self._test, 'test')
        self['toString'] = BuiltinFunction(self._to_string, 'toString')

    def _test(self, interp, this, args):
        s = to_string(args[0]) if args else ''
        return bool(self.regex.search(s))

    def _to_string(self, interp, this, args):
        return f"/{self.pattern}/{self.flags}"


class JSSet(dict):
    def __init__(self, iterable=None):
        super().__init__()
        self.items = []
        if iterable is not None:
            for x in iterable:
                if x not in self.items:
                    self.items.append(x)
        
        self['__set_items__'] = self.items
        self['size'] = float(len(self.items))
        self['add'] = BuiltinFunction(self._add, 'add')
        self['has'] = BuiltinFunction(self._has, 'has')
        self['delete'] = BuiltinFunction(self._delete, 'delete')
        self['clear'] = BuiltinFunction(self._clear, 'clear')

    def _add(self, interp, this, args):
        val = args[0] if args else UNDEFINED
        if val not in self.items:
            self.items.append(val)
            self['size'] = float(len(self.items))
        return self

    def _has(self, interp, this, args):
        val = args[0] if args else UNDEFINED
        return val in self.items

    def _delete(self, interp, this, args):
        val = args[0] if args else UNDEFINED
        if val in self.items:
            self.items.remove(val)
            self['size'] = float(len(self.items))
            return True
        return False

    def _clear(self, interp, this, args):
        self.items.clear()
        self['size'] = 0.0
        return UNDEFINED


class JSMap(dict):
    def __init__(self, iterable=None):
        super().__init__()
        self.entries = []
        if iterable is not None:
            for item in iterable:
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    self._set_key_val(item[0], item[1])

        self['__map_entries__'] = self.entries
        self['size'] = float(len(self.entries))
        self['set'] = BuiltinFunction(self._set, 'set')
        self['get'] = BuiltinFunction(self._get, 'get')
        self['has'] = BuiltinFunction(self._has, 'has')
        self['delete'] = BuiltinFunction(self._delete, 'delete')
        self['clear'] = BuiltinFunction(self._clear, 'clear')

    def _find_index(self, key):
        for idx, (k, v) in enumerate(self.entries):
            if strict_eq(k, key):
                return idx
        return -1

    def _set_key_val(self, key, val):
        idx = self._find_index(key)
        if idx != -1:
            self.entries[idx] = (key, val)
        else:
            self.entries.append((key, val))

    def _set(self, interp, this, args):
        key = args[0] if args else UNDEFINED
        val = args[1] if len(args) > 1 else UNDEFINED
        self._set_key_val(key, val)
        self['size'] = float(len(self.entries))
        return self

    def _get(self, interp, this, args):
        key = args[0] if args else UNDEFINED
        idx = self._find_index(key)
        if idx != -1:
            return self.entries[idx][1]
        return UNDEFINED

    def _has(self, interp, this, args):
        key = args[0] if args else UNDEFINED
        return self._find_index(key) != -1

    def _delete(self, interp, this, args):
        key = args[0] if args else UNDEFINED
        idx = self._find_index(key)
        if idx != -1:
            self.entries.pop(idx)
            self['size'] = float(len(self.entries))
            return True
        return False

    def _clear(self, interp, this, args):
        self.entries.clear()
        self['size'] = 0.0
        return UNDEFINED


class JSPromise(dict):
    def __init__(self, executor, interp):
        super().__init__()
        self.state = 'pending'
        self.value = UNDEFINED
        self.chains = []

        self['then'] = BuiltinFunction(self._then, 'then')
        self['catch'] = BuiltinFunction(self._catch, 'catch')
        self['finally'] = BuiltinFunction(self._finally, 'finally')

        if executor is not None:
            def resolve(interp_ctx, this_ctx, args):
                val = args[0] if args else UNDEFINED
                self._resolve(val, interp)
                return UNDEFINED

            def reject(interp_ctx, this_ctx, args):
                val = args[0] if args else UNDEFINED
                self._reject(val, interp)
                return UNDEFINED

            resolve_fn = BuiltinFunction(resolve, 'resolve')
            reject_fn = BuiltinFunction(reject, 'reject')

            try:
                interp.call_function(executor, [resolve_fn, reject_fn], UNDEFINED)
            except ThrowSignal as t:
                self._reject(t.value, interp)

    def _resolve(self, val, interp):
        if self.state != 'pending':
            return
        self.state = 'fulfilled'
        self.value = val
        self._notify(interp)

    def _reject(self, reason, interp):
        if self.state != 'pending':
            return
        self.state = 'rejected'
        self.value = reason
        self._notify(interp)

    def _notify(self, interp):
        for chain in self.chains:
            p_next = chain['promise']
            on_fulfilled = chain.get('on_fulfilled')
            on_rejected = chain.get('on_rejected')
            is_finally = chain.get('type') == 'finally'

            def run_chain(p_next=p_next, on_fulfilled=on_fulfilled, on_rejected=on_rejected, is_finally=is_finally):
                try:
                    if is_finally:
                        if on_fulfilled and on_fulfilled is not UNDEFINED:
                            interp.call_function(on_fulfilled, [], UNDEFINED)
                        if self.state == 'fulfilled':
                            p_next._resolve(self.value, interp)
                        else:
                            p_next._reject(self.value, interp)
                    else:
                        if self.state == 'fulfilled':
                            if on_fulfilled and on_fulfilled is not UNDEFINED:
                                res = interp.call_function(on_fulfilled, [self.value], UNDEFINED)
                                if isinstance(res, JSPromise):
                                    res.then(
                                        BuiltinFunction(lambda i, t, args: p_next._resolve(args[0] if args else UNDEFINED, interp)),
                                        BuiltinFunction(lambda i, t, args: p_next._reject(args[0] if args else UNDEFINED, interp))
                                    )
                                else:
                                    p_next._resolve(res, interp)
                            else:
                                p_next._resolve(self.value, interp)
                        else:
                            if on_rejected and on_rejected is not UNDEFINED:
                                res = interp.call_function(on_rejected, [self.value], UNDEFINED)
                                if isinstance(res, JSPromise):
                                    res.then(
                                        BuiltinFunction(lambda i, t, args: p_next._resolve(args[0] if args else UNDEFINED, interp)),
                                        BuiltinFunction(lambda i, t, args: p_next._reject(args[0] if args else UNDEFINED, interp))
                                    )
                                else:
                                    p_next._resolve(res, interp)
                            else:
                                p_next._reject(self.value, interp)
                except ThrowSignal as t:
                    p_next._reject(t.value, interp)

            t = threading.Thread(target=run_chain)
            t.start()
            interp.threads.append(t)
        self.chains.clear()

    def _then(self, interp, this, args):
        on_fulfilled = args[0] if args else UNDEFINED
        on_rejected = args[1] if len(args) > 1 else UNDEFINED
        p_next = JSPromise(None, interp)
        chain = {
            'promise': p_next,
            'on_fulfilled': on_fulfilled,
            'on_rejected': on_rejected,
            'type': 'then'
        }
        self.chains.append(chain)
        if self.state != 'pending':
            self._notify(interp)
        return p_next

    def _catch(self, interp, this, args):
        on_rejected = args[0] if args else UNDEFINED
        return self._then(interp, this, [UNDEFINED, on_rejected])

    def _finally(self, interp, this, args):
        on_finally = args[0] if args else UNDEFINED
        p_next = JSPromise(None, interp)
        chain = {
            'promise': p_next,
            'on_fulfilled': on_finally,
            'on_rejected': on_finally,
            'type': 'finally'
        }
        self.chains.append(chain)
        if self.state != 'pending':
            self._notify(interp)
        return p_next


class JSFunction:
    def __init__(self, name, params, body, closure_env, is_arrow=False, expr_body=False, this_val=None):
        self.name = name
        self.params = params
        self.body = body
        self.closure_env = closure_env
        self.is_arrow = is_arrow
        self.expr_body = expr_body
        self.this_val = this_val  # for arrow functions, lexical this

    def __repr__(self):
        return f'function {self.name or ""}() {{...}}'


class BuiltinFunction:
    def __init__(self, fn, name='builtin'):
        self.fn = fn  # signature: fn(interp, this, args) -> value
        self.name = name

    def __repr__(self):
        return f'function {self.name}() {{ [native code] }}'

    def __call__(self, interp, this, args):
        return self.fn(interp, this, args)


class JSClass:
    def __init__(self, name, methods, superclass):
        self.name = name
        self.methods = methods  # dict name -> (params, body, static)
        self.superclass = superclass

    def find_method(self, name):
        if name in self.methods and not self.methods[name]['static']:
            return self.methods[name]
        if self.superclass:
            return self.superclass.find_method(name)
        return None

    def find_static(self, name):
        if name in self.methods and self.methods[name]['static']:
            return self.methods[name]
        if self.superclass:
            return self.superclass.find_static(name)
        return None


# ---- control flow signals ----

class ReturnSignal(Exception):
    def __init__(self, value):
        self.value = value


class BreakSignal(Exception):
    def __init__(self, label=None):
        self.label = label


class ContinueSignal(Exception):
    def __init__(self, label=None):
        self.label = label


class ThrowSignal(Exception):
    def __init__(self, value):
        self.value = value


class JSThrow(Exception):
    """Represents an uncaught JS exception bubbling to top level."""
    def __init__(self, value):
        self.value = value


# ============================================================
# Environment
# ============================================================

class Environment:
    __slots__ = ('vars', 'consts', 'parent')

    def __init__(self, parent=None):
        self.vars = {}
        self.consts = set()
        self.parent = parent

    def define(self, name, value, kind='var'):
        self.vars[name] = value
        if kind == 'const':
            self.consts.add(name)

    def get(self, name):
        env = self
        while env is not None:
            if name in env.vars:
                return env.vars[name]
            env = env.parent
        raise ThrowSignal(f'{name} is not defined')

    def has(self, name):
        env = self
        while env is not None:
            if name in env.vars:
                return True
            env = env.parent
        return False

    def set(self, name, value):
        env = self
        while env is not None:
            if name in env.vars:
                if name in env.consts:
                    raise ThrowSignal(f'Assignment to constant variable {name}')
                env.vars[name] = value
                return
            env = env.parent
        # implicit global
        root = self
        while root.parent is not None:
            root = root.parent
        root.vars[name] = value


# ============================================================
# Value conversion helpers
# ============================================================

def js_num_to_str(n):
    if isinstance(n, bool):
        return 'true' if n else 'false'
    if isinstance(n, int):
        return str(n)
    if math.isnan(n):
        return 'NaN'
    if math.isinf(n):
        return 'Infinity' if n > 0 else '-Infinity'
    if n == 0:
        return '0'
    if n == int(n) and abs(n) < 1e21:
        return str(int(n))
    s = repr(n)
    return s


def js_typeof(val):
    if val is None:
        return 'undefined'
    if val is NULL:
        return 'object'
    if isinstance(val, bool):
        return 'boolean'
    if isinstance(val, (int, float)):
        return 'number'
    if isinstance(val, str):
        return 'string'
    if isinstance(val, (JSFunction, BuiltinFunction, JSClass)):
        return 'function'
    return 'object'


def to_number(val):
    if val is None:
        return float('nan')
    if val is NULL:
        return 0.0
    if isinstance(val, bool):
        return 1.0 if val else 0.0
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        s = val.strip()
        if s == '':
            return 0.0
        try:
            if s.lower().startswith('0x'):
                return float(int(s, 16))
            return float(s)
        except ValueError:
            return float('nan')
    if isinstance(val, list):
        if len(val) == 0:
            return 0.0
        if len(val) == 1:
            return to_number(val[0])
        return float('nan')
    return float('nan')


def to_boolean(val):
    if val is None or val is NULL:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        if isinstance(val, float) and math.isnan(val):
            return False
        return val != 0
    if isinstance(val, str):
        return len(val) > 0
    return True


def to_string(val):
    if val is None:
        return 'undefined'
    if val is NULL:
        return 'null'
    if isinstance(val, bool):
        return 'true' if val else 'false'
    if isinstance(val, (int, float)):
        return js_num_to_str(val)
    if isinstance(val, str):
        return val
    if isinstance(val, list):
        return ','.join('' if (x is None or x is NULL) else to_string(x) for x in val)
    if isinstance(val, JSRegExp):
        return f"/{val.pattern}/{val.flags}"
    if isinstance(val, JSSet):
        return '[object Set]'
    if isinstance(val, JSMap):
        return '[object Map]'
    if isinstance(val, JSPromise):
        return '[object Promise]'
    if isinstance(val, dict):
        return '[object Object]'
    if isinstance(val, (JSFunction, BuiltinFunction)):
        name = getattr(val, 'name', '') or ''
        return f'function {name}() {{ ... }}'
    if isinstance(val, JSClass):
        return f'class {val.name}'
    return str(val)


IDENT_RE = re.compile(r'^[A-Za-z_$][A-Za-z0-9_$]*$')


def display_inner(val):
    if val is None:
        return 'undefined'
    if val is NULL:
        return 'null'
    if isinstance(val, bool):
        return 'true' if val else 'false'
    if isinstance(val, (int, float)):
        return js_num_to_str(val)
    if isinstance(val, str):
        return "'" + val.replace("\\", "\\\\").replace("'", "\\'") + "'"
    if isinstance(val, list):
        if not val:
            return '[]'
        return '[ ' + ', '.join(display_inner(x) for x in val) + ' ]'
    if isinstance(val, JSRegExp):
        return f"/{val.pattern}/{val.flags}"
    if isinstance(val, JSSet):
        return f"Set({len(val.items)}) {{ " + ', '.join(display_inner(x) for x in val.items) + " }"
    if isinstance(val, JSMap):
        return f"Map({len(val.entries)}) {{ " + ', '.join(f"{display_inner(k)} => {display_inner(v)}" for k, v in val.entries) + " }"
    if isinstance(val, JSPromise):
        return '[Promise]'
    if isinstance(val, dict):
        if not val:
            return '{}'
        parts = []
        for k, v in val.items():
            key_str = k if IDENT_RE.match(str(k)) else "'" + str(k) + "'"
            parts.append(f'{key_str}: {display_inner(v)}')
        return '{ ' + ', '.join(parts) + ' }'
    if isinstance(val, (JSFunction,)):
        nm = val.name or 'anonymous'
        return f'[Function: {nm}]'
    if isinstance(val, BuiltinFunction):
        return f'[Function: {val.name}]'
    if isinstance(val, JSClass):
        return f'[class {val.name}]'
    return to_string(val)


def display_top(val):
    if isinstance(val, str):
        return val
    return display_inner(val)


def strict_eq(a, b):
    if (a is None) != (b is None):
        return False
    if a is None and b is None:
        return True
    if (a is NULL) or (b is NULL):
        return a is NULL and b is NULL
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        fa, fb = float(a), float(b)
        if math.isnan(fa) or math.isnan(fb):
            return False
        return fa == fb
    if isinstance(a, str) and isinstance(b, str):
        return a == b
    if isinstance(a, (list, dict)) and isinstance(b, (list, dict)):
        return a is b
    if type(a) != type(b):
        return False
    return a is b


def loose_eq(a, b):
    if strict_eq(a, b):
        return True
    a_nullish = a is None or a is NULL
    b_nullish = b is None or b is NULL
    if a_nullish and b_nullish:
        return True
    if a_nullish or b_nullish:
        return False
    if isinstance(a, bool) or isinstance(b, bool):
        return to_number(a) == to_number(b)
    if isinstance(a, (int, float)) and isinstance(b, str):
        bn = to_number(b)
        return not math.isnan(bn) and float(a) == bn
    if isinstance(a, str) and isinstance(b, (int, float)):
        an = to_number(a)
        return not math.isnan(an) and an == float(b)
    if isinstance(a, (list, dict)) and not isinstance(b, (list, dict)):
        return loose_eq(to_string(a), b)
    if isinstance(b, (list, dict)) and not isinstance(a, (list, dict)):
        return loose_eq(a, to_string(b))
    return False


def js_add(a, b):
    if isinstance(a, (list, dict)) or isinstance(b, (list, dict)) or isinstance(a, str) or isinstance(b, str):
        return to_string(a) + to_string(b)
    return to_number(a) + to_number(b)


def to_int32(n):
    n = to_number(n)
    if math.isnan(n) or math.isinf(n):
        return 0
    n = int(n)
    n = n & 0xFFFFFFFF
    if n >= 0x80000000:
        n -= 0x100000000
    return n


def to_uint32(n):
    n = to_number(n)
    if math.isnan(n) or math.isinf(n):
        return 0
    n = int(n)
    return n & 0xFFFFFFFF


# ============================================================
# Array methods
# ============================================================

def _norm_index(i, length):
    i = int(i)
    if i < 0:
        i = max(length + i, 0)
    else:
        i = min(i, length)
    return i


def arr_push(interp, arr, args):
    arr.extend(args)
    return float(len(arr))


def arr_pop(interp, arr, args):
    if not arr:
        return UNDEFINED
    return arr.pop()


def arr_shift(interp, arr, args):
    if not arr:
        return UNDEFINED
    return arr.pop(0)


def arr_unshift(interp, arr, args):
    arr[0:0] = list(args)
    return float(len(arr))


def arr_slice(interp, arr, args):
    n = len(arr)
    start = _norm_index(to_number(args[0]), n) if len(args) > 0 and args[0] is not None else 0
    end = _norm_index(to_number(args[1]), n) if len(args) > 1 and args[1] is not None else n
    return arr[start:end]


def arr_splice(interp, arr, args):
    n = len(arr)
    start = _norm_index(to_number(args[0]), n) if len(args) > 0 else 0
    if len(args) > 1:
        delete_count = int(to_number(args[1]))
        delete_count = max(0, min(delete_count, n - start))
    else:
        delete_count = n - start
    removed = arr[start:start + delete_count]
    items = list(args[2:])
    arr[start:start + delete_count] = items
    return removed


def arr_concat(interp, arr, args):
    result = list(arr)
    for a in args:
        if isinstance(a, list):
            result.extend(a)
        else:
            result.append(a)
    return result


def arr_includes(interp, arr, args):
    target = args[0] if args else UNDEFINED
    for x in arr:
        if strict_eq(x, target):
            return True
        if isinstance(x, float) and isinstance(target, float) and math.isnan(x) and math.isnan(target):
            return True
    return False


def arr_indexOf(interp, arr, args):
    target = args[0] if args else UNDEFINED
    for i, x in enumerate(arr):
        if strict_eq(x, target):
            return float(i)
    return -1.0


def arr_lastIndexOf(interp, arr, args):
    target = args[0] if args else UNDEFINED
    for i in range(len(arr) - 1, -1, -1):
        if strict_eq(arr[i], target):
            return float(i)
    return -1.0


def arr_sort(interp, arr, args):
    if args and args[0] is not None:
        cmp = args[0]
        import functools

        def comparator(a, b):
            r = to_number(interp.call_function(cmp, [a, b], UNDEFINED))
            if r != r:
                return 0
            if r < 0:
                return -1
            if r > 0:
                return 1
            return 0
        arr.sort(key=functools.cmp_to_key(comparator))
    else:
        arr.sort(key=lambda x: to_string(x))
    return arr


def arr_reverse(interp, arr, args):
    arr.reverse()
    return arr


def arr_join(interp, arr, args):
    sep = ',' if not args or args[0] is None else to_string(args[0])
    return sep.join('' if (x is None or x is NULL) else to_string(x) for x in arr)


def arr_map(interp, arr, args):
    cb = args[0]
    return [interp.call_function(cb, [el, float(i), arr], UNDEFINED) for i, el in enumerate(arr)]


def arr_filter(interp, arr, args):
    cb = args[0]
    return [el for i, el in enumerate(arr) if to_boolean(interp.call_function(cb, [el, float(i), arr], UNDEFINED))]


def arr_reduce(interp, arr, args):
    cb = args[0]
    if len(args) > 1:
        acc = args[1]
        start = 0
    else:
        if not arr:
            raise ThrowSignal('Reduce of empty array with no initial value')
        acc = arr[0]
        start = 1
    for i in range(start, len(arr)):
        acc = interp.call_function(cb, [acc, arr[i], float(i), arr], UNDEFINED)
    return acc


def arr_reduceRight(interp, arr, args):
    cb = args[0]
    if len(args) > 1:
        acc = args[1]
        start = len(arr) - 1
    else:
        if not arr:
            raise ThrowSignal('Reduce of empty array with no initial value')
        acc = arr[-1]
        start = len(arr) - 2
    for i in range(start, -1, -1):
        acc = interp.call_function(cb, [acc, arr[i], float(i), arr], UNDEFINED)
    return acc


def arr_find(interp, arr, args):
    cb = args[0]
    for i, el in enumerate(arr):
        if to_boolean(interp.call_function(cb, [el, float(i), arr], UNDEFINED)):
            return el
    return UNDEFINED


def arr_findIndex(interp, arr, args):
    cb = args[0]
    for i, el in enumerate(arr):
        if to_boolean(interp.call_function(cb, [el, float(i), arr], UNDEFINED)):
            return float(i)
    return -1.0


def arr_some(interp, arr, args):
    cb = args[0]
    for i, el in enumerate(arr):
        if to_boolean(interp.call_function(cb, [el, float(i), arr], UNDEFINED)):
            return True
    return False


def arr_every(interp, arr, args):
    cb = args[0]
    for i, el in enumerate(arr):
        if not to_boolean(interp.call_function(cb, [el, float(i), arr], UNDEFINED)):
            return False
    return True


def arr_forEach(interp, arr, args):
    cb = args[0]
    for i, el in enumerate(arr):
        interp.call_function(cb, [el, float(i), arr], UNDEFINED)
    return UNDEFINED


def arr_flat(interp, arr, args):
    depth = int(to_number(args[0])) if args else 1

    def flatten(a, d):
        out = []
        for x in a:
            if isinstance(x, list) and d > 0:
                out.extend(flatten(x, d - 1))
            else:
                out.append(x)
        return out
    return flatten(arr, depth)


def arr_fill(interp, arr, args):
    val = args[0] if args else UNDEFINED
    n = len(arr)
    start = _norm_index(to_number(args[1]), n) if len(args) > 1 else 0
    end = _norm_index(to_number(args[2]), n) if len(args) > 2 else n
    for i in range(start, end):
        arr[i] = val
    return arr


def arr_at(interp, arr, args):
    n = len(arr)
    idx = int(to_number(args[0])) if args else 0
    if idx < 0:
        idx += n
    if 0 <= idx < n:
        return arr[idx]
    return UNDEFINED


def arr_keys(interp, arr, args):
    return [float(i) for i in range(len(arr))]


def arr_flatMap(interp, arr, args):
    mapped = arr_map(interp, arr, args)
    return arr_flat(interp, mapped, [])


ARRAY_METHODS = {
    'push': arr_push, 'pop': arr_pop, 'shift': arr_shift, 'unshift': arr_unshift,
    'slice': arr_slice, 'splice': arr_splice, 'concat': arr_concat,
    'includes': arr_includes, 'indexOf': arr_indexOf, 'lastIndexOf': arr_lastIndexOf,
    'sort': arr_sort, 'reverse': arr_reverse, 'join': arr_join,
    'map': arr_map, 'filter': arr_filter, 'reduce': arr_reduce, 'reduceRight': arr_reduceRight,
    'find': arr_find, 'findIndex': arr_findIndex, 'some': arr_some, 'every': arr_every,
    'forEach': arr_forEach, 'flat': arr_flat, 'flatMap': arr_flatMap, 'fill': arr_fill,
    'at': arr_at, 'keys': arr_keys,
    'toString': lambda interp, arr, args: arr_join(interp, arr, []),
}


# ============================================================
# String methods
# ============================================================

def str_replace(interp, s, args):
    pattern = args[0] if args else ''
    repl = args[1] if len(args) > 1 else UNDEFINED
    pstr = to_string(pattern)
    idx = s.find(pstr)
    if idx == -1:
        return s
    if isinstance(repl, (JSFunction, BuiltinFunction)):
        rep_str = to_string(interp.call_function(repl, [pstr, float(idx), s], UNDEFINED))
    else:
        rep_str = to_string(repl)
    return s[:idx] + rep_str + s[idx + len(pstr):]


def str_replaceAll(interp, s, args):
    pattern = args[0] if args else ''
    repl = args[1] if len(args) > 1 else UNDEFINED
    pstr = to_string(pattern)
    if isinstance(repl, (JSFunction, BuiltinFunction)):
        if pstr == '':
            return s
        parts = s.split(pstr)
        out = []
        idx = 0
        for i, part in enumerate(parts):
            out.append(part)
            if i < len(parts) - 1:
                idx += len(part)
                out.append(to_string(interp.call_function(repl, [pstr, float(idx), s], UNDEFINED)))
                idx += len(pstr)
        return ''.join(out)
    rep_str = to_string(repl)
    return s.replace(pstr, rep_str)


def str_substring(interp, s, args):
    n = len(s)
    a = int(to_number(args[0])) if len(args) > 0 and args[0] is not None else 0
    b = int(to_number(args[1])) if len(args) > 1 and args[1] is not None else n
    a = max(0, min(a, n))
    b = max(0, min(b, n))
    if a > b:
        a, b = b, a
    return s[a:b]


def str_slice(interp, s, args):
    n = len(s)
    start = _norm_index(to_number(args[0]), n) if len(args) > 0 and args[0] is not None else 0
    end = _norm_index(to_number(args[1]), n) if len(args) > 1 and args[1] is not None else n
    if start >= end:
        return ''
    return s[start:end]


def str_split(interp, s, args):
    if not args or args[0] is None:
        return [s]
    sep = args[0]
    limit = int(to_number(args[1])) if len(args) > 1 and args[1] is not None else None
    sepstr = to_string(sep)
    if sepstr == '':
        result = list(s)
    else:
        result = s.split(sepstr)
    if limit is not None:
        result = result[:limit]
    return result


def str_trim(interp, s, args):
    return s.strip()


def str_indexOf(interp, s, args):
    target = to_string(args[0]) if args else 'undefined'
    start = int(to_number(args[1])) if len(args) > 1 else 0
    idx = s.find(target, start)
    return float(idx)


def str_padStart(interp, s, args):
    target_len = int(to_number(args[0])) if args else 0
    pad = to_string(args[1]) if len(args) > 1 and args[1] is not None else ' '
    if len(s) >= target_len or not pad:
        return s
    needed = target_len - len(s)
    full_pad = (pad * (needed // len(pad) + 1))[:needed]
    return full_pad + s


def str_padEnd(interp, s, args):
    target_len = int(to_number(args[0])) if args else 0
    pad = to_string(args[1]) if len(args) > 1 and args[1] is not None else ' '
    if len(s) >= target_len or not pad:
        return s
    needed = target_len - len(s)
    full_pad = (pad * (needed // len(pad) + 1))[:needed]
    return s + full_pad


def str_charAt(interp, s, args):
    idx = int(to_number(args[0])) if args else 0
    if 0 <= idx < len(s):
        return s[idx]
    return ''


def str_charCodeAt(interp, s, args):
    idx = int(to_number(args[0])) if args else 0
    if 0 <= idx < len(s):
        return float(ord(s[idx]))
    return float('nan')


def str_concat(interp, s, args):
    return s + ''.join(to_string(a) for a in args)


def str_at(interp, s, args):
    idx = int(to_number(args[0])) if args else 0
    if idx < 0:
        idx += len(s)
    if 0 <= idx < len(s):
        return s[idx]
    return UNDEFINED


STRING_METHODS = {
    'replace': str_replace, 'replaceAll': str_replaceAll,
    'substring': str_substring, 'slice': str_slice, 'split': str_split,
    'trim': str_trim,
    'trimStart': lambda i, s, a: s.lstrip(),
    'trimEnd': lambda i, s, a: s.rstrip(),
    'toUpperCase': lambda i, s, a: s.upper(),
    'toLowerCase': lambda i, s, a: s.lower(),
    'includes': lambda i, s, a: (to_string(a[0]) if a else 'undefined') in s,
    'startsWith': lambda i, s, a: s.startswith(to_string(a[0]) if a else 'undefined', int(to_number(a[1])) if len(a) > 1 else 0),
    'endsWith': lambda i, s, a: s.endswith(to_string(a[0]) if a else 'undefined'),
    'indexOf': str_indexOf,
    'lastIndexOf': lambda i, s, a: float(s.rfind(to_string(a[0]) if a else 'undefined')),
    'charAt': str_charAt,
    'charCodeAt': str_charCodeAt,
    'codePointAt': str_charCodeAt,
    'padStart': str_padStart,
    'padEnd': str_padEnd,
    'repeat': lambda i, s, a: s * int(to_number(a[0])) if a else s,
    'concat': str_concat,
    'at': str_at,
    'toString': lambda i, s, a: s,
    'valueOf': lambda i, s, a: s,
    'normalize': lambda i, s, a: s,
    'localeCompare': lambda i, s, a: float((s > to_string(a[0])) - (s < to_string(a[0]))) if a else 0.0,
}


def num_toFixed(interp, num, args):
    digits = int(to_number(args[0])) if args and args[0] is not None else 0
    try:
        return f"{num:.{digits}f}"
    except Exception:
        return f"{num:.0f}"


def num_toString(interp, num, args):
    radix = int(to_number(args[0])) if args and args[0] is not None else 10
    if radix == 10:
        return js_num_to_str(num)
    if radix == 16:
        return hex(int(num))[2:]
    return js_num_to_str(num)


NUMBER_METHODS = {
    'toFixed': num_toFixed,
    'toString': num_toString,
    'valueOf': lambda i, n, a: n,
}


# ============================================================
# JSON support
# ============================================================

def json_to_js(val):
    if val is None:
        return NULL
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        return val
    if isinstance(val, list):
        return [json_to_js(x) for x in val]
    if isinstance(val, dict):
        return {k: json_to_js(v) for k, v in val.items()}
    return NULL


def js_to_json_str(val, indent=None, cur_indent=''):
    if val is None or isinstance(val, (JSFunction, BuiltinFunction)):
        return None
    if val is NULL:
        return 'null'
    if isinstance(val, bool):
        return 'true' if val else 'false'
    if isinstance(val, (int, float)):
        if math.isnan(val) or math.isinf(val):
            return 'null'
        return js_num_to_str(val)
    if isinstance(val, str):
        return _json_quote(val)
    next_indent = cur_indent + indent if indent else ''
    if isinstance(val, list):
        if not val:
            return '[]'
        items = []
        for x in val:
            s = js_to_json_str(x, indent, next_indent)
            if s is None:
                s = 'null'
            items.append(s)
        if indent:
            inner = (',\n' + next_indent).join(items)
            return '[\n' + next_indent + inner + '\n' + cur_indent + ']'
        return '[' + ','.join(items) + ']'
    if isinstance(val, dict):
        items = []
        for k, v in val.items():
            s = js_to_json_str(v, indent, next_indent)
            if s is None:
                continue
            items.append((_json_quote(str(k)), s))
        if not items:
            return '{}'
        if indent:
            inner = (',\n' + next_indent).join(f'{k}: {v}' for k, v in items)
            return '{\n' + next_indent + inner + '\n' + cur_indent + '}'
        return '{' + ','.join(f'{k}:{v}' for k, v in items) + '}'
    return 'null'


def _json_quote(s):
    out = ['"']
    for c in s:
        if c == '"':
            out.append('\\"')
        elif c == '\\':
            out.append('\\\\')
        elif c == '\n':
            out.append('\\n')
        elif c == '\t':
            out.append('\\t')
        elif c == '\r':
            out.append('\\r')
        elif ord(c) < 0x20:
            out.append('\\u%04x' % ord(c))
        else:
            out.append(c)
    out.append('"')
    return ''.join(out)


def extract_names(pattern, names):
    if pattern is None:
        return
    if pattern['type'] == 'Identifier':
        names.add(pattern['name'])
    elif pattern['type'] == 'ArrayPattern':
        for el in pattern['elements']:
            if el is not None:
                if el['type'] == 'RestElement':
                    extract_names(el['argument'], names)
                else:
                    extract_names(el, names)
    elif pattern['type'] == 'ObjectPattern':
        for prop in pattern['properties']:
            if prop.get('type') == 'RestElement':
                extract_names(prop['argument'], names)
            else:
                extract_names(prop['value'], names)
    elif pattern['type'] == 'AssignmentPattern':
        extract_names(pattern['left'], names)


def scan_vars(nodes, names):
    if not nodes:
        return
    if isinstance(nodes, list):
        for node in nodes:
            scan_vars(node, names)
        return
    if not isinstance(nodes, dict):
        return

    t = nodes.get('type')
    if not t:
        return

    if t == 'VariableDeclaration' and nodes.get('kind') == 'var':
        for decl in nodes['declarations']:
            extract_names(decl['id'], names)
    elif t in ('FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ClassDeclaration'):
        return
    else:
        for k, v in nodes.items():
            if isinstance(v, (dict, list)):
                scan_vars(v, names)


class Interpreter:
    def __init__(self):
        self.threads = []
        self.global_env = Environment(None)
        self.setup_globals()

    # -------------------- global setup --------------------
    def setup_globals(self):
        g = self.global_env
        g.define('undefined', UNDEFINED)
        g.define('NaN', float('nan'))
        g.define('Infinity', float('inf'))
        g.define('globalThis', {})

        def bf(fn, name='builtin'):
            return BuiltinFunction(fn, name)

        # console
        def console_log(interp, this, args):
            print(' '.join(display_top(a) for a in args))
            return UNDEFINED
        console = {
            'log': bf(console_log, 'log'),
            'error': bf(console_log, 'error'),
            'warn': bf(console_log, 'warn'),
            'info': bf(console_log, 'info'),
            'debug': bf(console_log, 'debug'),
        }
        g.define('console', console)

        # Math
        def m1(f):
            return bf(lambda interp, this, args: float(f(to_number(args[0]))) if args else float('nan'))

        def js_round(x):
            if math.isnan(x) or math.isinf(x):
                return x
            return math.floor(x + 0.5)

        def js_sign(x):
            if math.isnan(x):
                return float('nan')
            if x > 0:
                return 1.0
            if x < 0:
                return -1.0
            return x

        math_obj = {
            'PI': math.pi, 'E': math.e, 'LN2': math.log(2), 'LN10': math.log(10),
            'SQRT2': math.sqrt(2),
            'floor': bf(lambda interp, this, args: float(math.floor(to_number(args[0]))), 'floor'),
            'ceil': bf(lambda interp, this, args: float(math.ceil(to_number(args[0]))), 'ceil'),
            'round': bf(lambda interp, this, args: float(js_round(to_number(args[0]))), 'round'),
            'trunc': bf(lambda interp, this, args: float(math.trunc(to_number(args[0]))), 'trunc'),
            'abs': m1(abs),
            'sqrt': bf(lambda interp, this, args: float(math.sqrt(to_number(args[0]))) if to_number(args[0]) >= 0 else float('nan'), 'sqrt'),
            'cbrt': bf(lambda interp, this, args: math.copysign(abs(to_number(args[0])) ** (1 / 3), to_number(args[0])), 'cbrt'),
            'pow': bf(lambda interp, this, args: float(to_number(args[0]) ** to_number(args[1])), 'pow'),
            'sign': bf(lambda interp, this, args: js_sign(to_number(args[0])), 'sign'),
            'log': m1(math.log), 'log2': m1(math.log2), 'log10': m1(math.log10),
            'exp': m1(math.exp),
            'sin': m1(math.sin), 'cos': m1(math.cos), 'tan': m1(math.tan),
            'asin': m1(math.asin), 'acos': m1(math.acos), 'atan': m1(math.atan),
            'atan2': bf(lambda interp, this, args: math.atan2(to_number(args[0]), to_number(args[1])), 'atan2'),
            'hypot': bf(lambda interp, this, args: math.hypot(*[to_number(a) for a in args]), 'hypot'),
            'max': bf(lambda interp, this, args: float('-inf') if not args else (
                float('nan') if any(math.isnan(to_number(a)) for a in args) else max(to_number(a) for a in args)), 'max'),
            'min': bf(lambda interp, this, args: float('inf') if not args else (
                float('nan') if any(math.isnan(to_number(a)) for a in args) else min(to_number(a) for a in args)), 'min'),
            'random': bf(lambda interp, this, args: random.random(), 'random'),
        }
        g.define('Math', math_obj)

        # JSON
        def json_stringify(interp, this, args):
            val = args[0] if args else UNDEFINED
            indent = None
            if len(args) > 2 and args[2] is not None:
                ind = args[2]
                if isinstance(ind, (int, float)):
                    indent = ' ' * int(ind)
                elif isinstance(ind, str):
                    indent = ind
            result = js_to_json_str(val, indent)
            return result if result is not None else UNDEFINED

        def json_parse(interp, this, args):
            import json as _j
            text = to_string(args[0]) if args else ''
            try:
                parsed = _j.loads(text)
            except Exception as e:
                raise ThrowSignal('Unexpected token in JSON: ' + str(e))
            return json_to_js(parsed)
        g.define('JSON', {'stringify': bf(json_stringify, 'stringify'), 'parse': bf(json_parse, 'parse')})

        # Object
        def obj_keys(interp, this, args):
            o = args[0] if args else {}
            if isinstance(o, list):
                return [str(i) for i in range(len(o))]
            if isinstance(o, dict):
                return list(o.keys())
            return []

        def obj_values(interp, this, args):
            o = args[0] if args else {}
            if isinstance(o, list):
                return list(o)
            if isinstance(o, dict):
                return list(o.values())
            return []

        def obj_entries(interp, this, args):
            o = args[0] if args else {}
            if isinstance(o, list):
                return [[str(i), v] for i, v in enumerate(o)]
            if isinstance(o, dict):
                return [[k, v] for k, v in o.items()]
            return []

        def obj_assign(interp, this, args):
            target = args[0] if args else {}
            for src in args[1:]:
                if isinstance(src, dict):
                    target.update(src)
            return target

        def obj_fromEntries(interp, this, args):
            entries = args[0] if args else []
            result = {}
            for e in entries:
                k, v = e[0], e[1]
                result[to_string(k)] = v
            return result

        obj_namespace = {
            'keys': bf(obj_keys, 'keys'),
            'values': bf(obj_values, 'values'),
            'entries': bf(obj_entries, 'entries'),
            'assign': bf(obj_assign, 'assign'),
            'freeze': bf(lambda interp, this, args: args[0] if args else UNDEFINED, 'freeze'),
            'fromEntries': bf(obj_fromEntries, 'fromEntries'),
            'getPrototypeOf': bf(lambda interp, this, args: NULL, 'getPrototypeOf'),
        }
        g.define('Object', obj_namespace)

        # Array
        def array_isArray(interp, this, args):
            return bool(args) and isinstance(args[0], list)

        def array_from(interp, this, args):
            src = args[0] if args else []
            if isinstance(src, str):
                items = list(src)
            elif isinstance(src, list):
                items = list(src)
            elif isinstance(src, dict):
                if 'length' in src:
                    n = int(to_number(src['length']))
                    items = [src.get(str(i), UNDEFINED) for i in range(n)]
                else:
                    items = list(src.values())
            else:
                items = []
            if len(args) > 1 and args[1] is not None:
                cb = args[1]
                items = [interp.call_function(cb, [v, float(i)], UNDEFINED) for i, v in enumerate(items)]
            return items

        def array_of(interp, this, args):
            return list(args)

        array_namespace = {
            'isArray': bf(array_isArray, 'isArray'),
            'from': bf(array_from, 'from'),
            'of': bf(array_of, 'of'),
        }
        g.define('Array', array_namespace)

        # Number
        def number_isInteger(interp, this, args):
            if not args or not isinstance(args[0], (int, float)) or isinstance(args[0], bool):
                return False
            n = args[0]
            return not math.isnan(n) and not math.isinf(n) and n == int(n)

        def number_isFinite(interp, this, args):
            if not args or not isinstance(args[0], (int, float)) or isinstance(args[0], bool):
                return False
            return not math.isnan(args[0]) and not math.isinf(args[0])

        number_namespace = {
            'isInteger': bf(number_isInteger, 'isInteger'),
            'isFinite': bf(number_isFinite, 'isFinite'),
            'isNaN': bf(lambda interp, this, args: isinstance(args[0], float) and math.isnan(args[0]) if args else False, 'isNaN'),
            'parseFloat': bf(lambda interp, this, args: js_parseFloat(args[0]) if args else float('nan'), 'parseFloat'),
            'parseInt': bf(lambda interp, this, args: js_parseInt(args), 'parseInt'),
            'MAX_SAFE_INTEGER': float(2**53 - 1),
            'MIN_SAFE_INTEGER': float(-(2**53 - 1)),
            'MAX_VALUE': sys.float_info.max,
            'EPSILON': 2.220446049250313e-16,
            'POSITIVE_INFINITY': float('inf'),
            'NEGATIVE_INFINITY': float('-inf'),
            'NaN': float('nan'),
        }
        g.define('Number', number_namespace)

        # String namespace (limited)
        def string_fromCharCode(interp, this, args):
            return ''.join(chr(int(to_number(a))) for a in args)
        g.define('String', {'fromCharCode': bf(string_fromCharCode, 'fromCharCode')})

        # global functions
        g.define('parseInt', bf(lambda interp, this, args: js_parseInt(args), 'parseInt'))
        g.define('parseFloat', bf(lambda interp, this, args: js_parseFloat(args[0]) if args else float('nan'), 'parseFloat'))
        g.define('isNaN', bf(lambda interp, this, args: math.isnan(to_number(args[0])) if args else True, 'isNaN'))
        g.define('isFinite', bf(lambda interp, this, args: (not math.isnan(to_number(args[0])) and not math.isinf(to_number(args[0]))) if args else False, 'isFinite'))

        def js_String(interp, this, args):
            return to_string(args[0]) if args else ''

        def js_Number(interp, this, args):
            return to_number(args[0]) if args else 0.0

        def js_Boolean(interp, this, args):
            return to_boolean(args[0]) if args else False
        g.define('String', {**g.get('String'), '__call__': bf(js_String)})
        g.define('Number', {**g.get('Number'), '__call__': bf(js_Number)})
        g.define('Boolean', bf(js_Boolean, 'Boolean'))

        # Date (minimal)
        def date_new(args):
            if not args:
                ms = _time.time() * 1000.0
            elif len(args) == 1 and isinstance(args[0], (int, float)):
                ms = float(args[0])
            else:
                import datetime
                try:
                    y = int(to_number(args[0]))
                    mo = int(to_number(args[1])) if len(args) > 1 else 0
                    d = int(to_number(args[2])) if len(args) > 2 else 1
                    h = int(to_number(args[3])) if len(args) > 3 else 0
                    mi = int(to_number(args[4])) if len(args) > 4 else 0
                    se = int(to_number(args[5])) if len(args) > 5 else 0
                    dt = datetime.datetime(y, mo + 1, d, h, mi, se)
                    ms = dt.timestamp() * 1000.0
                except Exception:
                    ms = 0.0
            
            dt_dict = {'__date_ms__': ms}
            import datetime
            def get_full_year(interp, this, args):
                dt = datetime.datetime.fromtimestamp(this['__date_ms__'] / 1000.0)
                return float(dt.year)
            def get_month(interp, this, args):
                dt = datetime.datetime.fromtimestamp(this['__date_ms__'] / 1000.0)
                return float(dt.month - 1)
            def get_date(interp, this, args):
                dt = datetime.datetime.fromtimestamp(this['__date_ms__'] / 1000.0)
                return float(dt.day)
            def get_time(interp, this, args):
                return this['__date_ms__']

            dt_dict['getFullYear'] = bf(get_full_year, 'getFullYear')
            dt_dict['getMonth'] = bf(get_month, 'getMonth')
            dt_dict['getDate'] = bf(get_date, 'getDate')
            dt_dict['getTime'] = bf(get_time, 'getTime')
            return dt_dict
        self.date_new = date_new
        g.define('Date', BuiltinFunction(lambda interp, this, args: date_new(args), 'Date'))
        g.define('Set', BuiltinFunction(lambda interp, this, args: JSSet(args[0] if args else None), 'Set'))
        g.define('Map', BuiltinFunction(lambda interp, this, args: JSMap(args[0] if args else None), 'Map'))
        g.define('Promise', BuiltinFunction(lambda interp, this, args: JSPromise(args[0], interp), 'Promise'))

        def set_timeout(interp, this, args):
            callback = args[0]
            delay = to_number(args[1]) if len(args) > 1 else 0.0
            def run():
                _time.sleep(delay / 1000.0)
                interp.call_function(callback, [], UNDEFINED)
            t = threading.Thread(target=run)
            t.start()
            interp.threads.append(t)
            return UNDEFINED
        g.define('setTimeout', BuiltinFunction(set_timeout, 'setTimeout'))

    # -------------------- run --------------------
    def run(self, src):
        program = parse(src)
        global_vars = set()
        scan_vars(program['body'], global_vars)
        for name in global_vars:
            self.global_env.define(name, UNDEFINED, 'var')
        try:
            self.exec_block(program['body'], self.global_env, new_scope=False)
        except ReturnSignal:
            pass
        except ThrowSignal as t:
            val = t.value
            msg = val.get('message') if isinstance(val, dict) else to_string(val)
            sys.stderr.write('Uncaught ' + (to_string(val) if not isinstance(val, dict) else str(msg)) + '\n')
            sys.exit(1)

        # Wait for all scheduled tasks to finish
        i = 0
        while i < len(self.threads):
            self.threads[i].join()
            i += 1

    def eval(self, node, env):
        if node is None:
            return UNDEFINED
        t = node['type']
        if t == 'NumericLiteral' or t == 'StringLiteral' or t == 'BooleanLiteral':
            return node['value']
        elif t == 'NullLiteral':
            return NULL
        elif t == 'RegExpLiteral':
            return JSRegExp(node['pattern'], node['flags'])
        elif t == 'Identifier':
            return env.get(node['name'])
        elif t == 'ThisExpression':
            return env.get('this') if env.has('this') else UNDEFINED
        elif t == 'ArrayExpression':
            result = []
            for el in node['elements']:
                if el is None:
                    result.append(UNDEFINED)
                elif el['type'] == 'SpreadElement':
                    val = self.eval(el['argument'], env)
                    if isinstance(val, list):
                        result.extend(val)
                    else:
                        result.append(val)
                else:
                    result.append(self.eval(el, env))
            return result
        elif t == 'ObjectExpression':
            result = {}
            for prop in node['properties']:
                if prop.get('type') == 'SpreadElement':
                    val = self.eval(prop['argument'], env)
                    if isinstance(val, dict):
                        result.update(val)
                else:
                    if prop['computed']:
                        key_val = to_string(self.eval(prop['key'], env))
                    elif prop['key']['type'] == 'Identifier':
                        key_val = prop['key']['name']
                    else:
                        key_val = to_string(prop['key']['value'])
                    val = self.eval(prop['value'], env)
                    result[key_val] = val
            return result
        elif t == 'FunctionExpression':
            return JSFunction(node['name'], node['params'], node['body'], env)
        elif t == 'ArrowFunctionExpression':
            this_val = env.get('this') if env.has('this') else UNDEFINED
            return JSFunction(None, node['params'], node['body'], env, is_arrow=True, expr_body=node['expression'], this_val=this_val)
        elif t == 'SequenceExpression':
            val = UNDEFINED
            for expr in node['expressions']:
                val = self.eval(expr, env)
            return val
        elif t == 'UnaryExpression':
            op = node['operator']
            arg_val = self.eval(node['argument'], env)
            if op == '!':
                return not to_boolean(arg_val)
            elif op == '-':
                return -to_number(arg_val)
            elif op == '+':
                return to_number(arg_val)
            elif op == '~':
                return float(~to_int32(arg_val))
            elif op == 'typeof':
                return js_typeof(arg_val)
            elif op == 'void':
                return UNDEFINED
            elif op == 'delete':
                return True
            raise Exception(f'Unknown unary operator: {op}')
        elif t == 'UpdateExpression':
            op = node['operator']
            arg = node['argument']
            prefix = node['prefix']
            if arg['type'] == 'Identifier':
                name = arg['name']
                curr = to_number(env.get(name))
                new_val = curr + 1.0 if op == '++' else curr - 1.0
                env.set(name, new_val)
                return new_val if prefix else curr
            elif arg['type'] == 'MemberExpression':
                obj = self.eval(arg['object'], env)
                if arg['computed']:
                    prop = to_string(self.eval(arg['property'], env))
                else:
                    prop = arg['property']['name']
                curr = to_number(obj.get(prop, UNDEFINED) if isinstance(obj, dict) else (obj[int(to_number(prop))] if isinstance(obj, list) else UNDEFINED))
                new_val = curr + 1.0 if op == '++' else curr - 1.0
                if isinstance(obj, dict):
                    obj[prop] = new_val
                elif isinstance(obj, list):
                    obj[int(to_number(prop))] = new_val
                return new_val if prefix else curr
            raise Exception(f'Invalid update target')
        elif t == 'BinaryExpression':
            op = node['operator']
            left_val = self.eval(node['left'], env)
            right_val = self.eval(node['right'], env)
            if op == '+':
                return js_add(left_val, right_val)
            elif op == '-':
                return to_number(left_val) - to_number(right_val)
            elif op == '*':
                return to_number(left_val) * to_number(right_val)
            elif op == '/':
                r = to_number(right_val)
                return float('nan') if r == 0 else to_number(left_val) / r
            elif op == '%':
                r = to_number(right_val)
                return float('nan') if r == 0 else math.fmod(to_number(left_val), r)
            elif op == '**':
                return to_number(left_val) ** to_number(right_val)
            elif op == '==':
                return loose_eq(left_val, right_val)
            elif op == '!=':
                return not loose_eq(left_val, right_val)
            elif op == '===':
                return strict_eq(left_val, right_val)
            elif op == '!==':
                return not strict_eq(left_val, right_val)
            elif op == '<':
                return to_number(left_val) < to_number(right_val)
            elif op == '>':
                return to_number(left_val) > to_number(right_val)
            elif op == '<=':
                return to_number(left_val) <= to_number(right_val)
            elif op == '>=':
                return to_number(left_val) >= to_number(right_val)
            elif op == 'in':
                if isinstance(right_val, dict):
                    return to_string(left_val) in right_val
                elif isinstance(right_val, list):
                    return 0 <= int(to_number(left_val)) < len(right_val)
                return False
            elif op == 'instanceof':
                if not right_val or right_val is UNDEFINED:
                    raise ThrowSignal("Right-hand side of 'instanceof' is not an object")
                if right_val == env.get('Array'):
                    return isinstance(left_val, list)
                if right_val == env.get('Object'):
                    return isinstance(left_val, (list, dict))
                if isinstance(left_val, dict) and '__class__' in left_val:
                    cls = left_val['__class__']
                    while cls is not None:
                        if cls == right_val:
                            return True
                        cls = cls.superclass
                    return False
                return False
            raise Exception(f'Unknown binary operator: {op}')
        elif t == 'LogicalExpression':
            op = node['operator']
            left_val = self.eval(node['left'], env)
            if op == '&&':
                if not to_boolean(left_val):
                    return left_val
                return self.eval(node['right'], env)
            elif op == '||':
                if to_boolean(left_val):
                    return left_val
                return self.eval(node['right'], env)
            elif op == '??':
                if left_val is not UNDEFINED and left_val is not NULL:
                    return left_val
                return self.eval(node['right'], env)
            raise Exception(f'Unknown logical operator: {op}')
        elif t == 'ConditionalExpression':
            test_val = self.eval(node['test'], env)
            if to_boolean(test_val):
                return self.eval(node['consequent'], env)
            else:
                return self.eval(node['alternate'], env)
        elif t == 'AssignmentExpression':
            op = node['operator']
            left = node['left']
            right_val = self.eval(node['right'], env)
            if op != '=':
                curr_op = op[:-1]
                if left['type'] == 'Identifier':
                    curr_val = env.get(left['name'])
                elif left['type'] == 'MemberExpression':
                    obj = self.eval(left['object'], env)
                    if left['computed']:
                        prop = to_string(self.eval(left['property'], env))
                    else:
                        prop = left['property']['name']
                    curr_val = obj.get(prop, UNDEFINED) if isinstance(obj, dict) else (obj[int(to_number(prop))] if isinstance(obj, list) else UNDEFINED)
                else:
                    raise Exception('Invalid left-hand side in assignment')
                if curr_op == '+':
                    right_val = js_add(curr_val, right_val)
                elif curr_op == '-':
                    right_val = to_number(curr_val) - to_number(right_val)
                elif curr_op == '*':
                    right_val = to_number(curr_val) * to_number(right_val)
                elif curr_op == '/':
                    right_val = to_number(curr_val) / to_number(right_val)
                elif curr_op == '%':
                    right_val = math.fmod(to_number(curr_val), to_number(right_val))
                elif curr_op == '**':
                    right_val = to_number(curr_val) ** to_number(right_val)
            if left['type'] == 'Identifier':
                env.set(left['name'], right_val)
                return right_val
            elif left['type'] == 'MemberExpression':
                obj = self.eval(left['object'], env)
                if left['computed']:
                    prop = to_string(self.eval(left['property'], env))
                else:
                    prop = left['property']['name']
                if isinstance(obj, dict):
                    obj[prop] = right_val
                elif isinstance(obj, list):
                    obj[int(to_number(prop))] = right_val
                return right_val
            elif left['type'] == 'ArrayPattern' or left['type'] == 'ObjectPattern':
                self.bind_pattern(left, right_val, env)
                return right_val
            raise Exception('Invalid left-hand side in assignment')
        elif t == 'MemberExpression':
            obj = self.eval(node['object'], env)
            if obj is UNDEFINED or obj is NULL:
                if node.get('optional'):
                    return UNDEFINED
                raise ThrowSignal(f"Cannot read properties of {to_string(obj)}")
            if node['computed']:
                prop = to_string(self.eval(node['property'], env))
            else:
                prop = node['property']['name']
            if isinstance(obj, list):
                if prop == 'length':
                    return float(len(obj))
                if prop in ARRAY_METHODS:
                    return BuiltinFunction(lambda interp, this, args: ARRAY_METHODS[prop](interp, this, args), prop)
                try:
                    idx = int(to_number(prop))
                    if 0 <= idx < len(obj):
                        return obj[idx]
                except ValueError:
                    pass
                return UNDEFINED
            elif isinstance(obj, str):
                if prop == 'length':
                    return float(len(obj))
                if prop in STRING_METHODS:
                    return BuiltinFunction(lambda interp, this, args: STRING_METHODS[prop](interp, this, args), prop)
                try:
                    idx = int(to_number(prop))
                    if 0 <= idx < len(obj):
                        return obj[idx]
                except ValueError:
                    pass
                return UNDEFINED
            elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
                if prop in NUMBER_METHODS:
                    return BuiltinFunction(lambda interp, this, args: NUMBER_METHODS[prop](interp, this, args), prop)
                return UNDEFINED
            elif isinstance(obj, dict):
                if prop in obj:
                    return obj[prop]
                if '__class__' in obj:
                    cls = obj['__class__']
                    method = cls.find_method(prop)
                    if method:
                        return JSFunction(prop, method['params'], method['body'], cls.def_env, this_val=obj)
                return UNDEFINED
            elif isinstance(obj, JSClass):
                static_method = obj.find_static(prop)
                if static_method:
                    return JSFunction(prop, static_method['params'], static_method['body'], obj.def_env)
                return UNDEFINED
            return UNDEFINED
        elif t == 'CallExpression':
            callee_val = self.eval(node['callee'], env)
            if node['callee']['type'] == 'MemberExpression':
                this_val = self.eval(node['callee']['object'], env)
            else:
                this_val = UNDEFINED
            args_vals = []
            for arg in node['arguments']:
                if arg['type'] == 'SpreadElement':
                    val = self.eval(arg['argument'], env)
                    if isinstance(val, list):
                        args_vals.extend(val)
                    else:
                        args_vals.append(val)
                else:
                    args_vals.append(self.eval(arg, env))
            if callee_val is UNDEFINED:
                if node.get('optional'):
                    return UNDEFINED
                raise ThrowSignal("Callee is not a function")
            return self.call_function(callee_val, args_vals, this_val)
        elif t == 'NewExpression':
            callee_val = self.eval(node['callee'], env)
            args_vals = [self.eval(arg, env) for arg in node['arguments']]
            if isinstance(callee_val, JSClass):
                inst = {}
                inst['__class__'] = callee_val
                ctor = callee_val.find_method('constructor')
                if ctor:
                    ctor_func = JSFunction('constructor', ctor['params'], ctor['body'], callee_val.def_env)
                    self.call_function(ctor_func, args_vals, inst)
                return inst
            elif isinstance(callee_val, BuiltinFunction) and callee_val.name == 'Date':
                return self.date_new(args_vals)
            elif isinstance(callee_val, BuiltinFunction) and callee_val.name == 'Set':
                return JSSet(args_vals[0] if args_vals else None)
            elif isinstance(callee_val, BuiltinFunction) and callee_val.name == 'Map':
                return JSMap(args_vals[0] if args_vals else None)
            elif isinstance(callee_val, BuiltinFunction) and callee_val.name == 'Promise':
                return JSPromise(args_vals[0], self)
            raise ThrowSignal("Callee is not a class constructor")
        elif t == 'TemplateLiteral':
            parts = []
            for i in range(len(node['quasis'])):
                parts.append(node['quasis'][i])
                if i < len(node['expressions']):
                    parts.append(to_string(self.eval(node['expressions'][i], env)))
            return ''.join(parts)
        raise Exception(f'Unknown expression type: {t}')

    def call_function(self, func, args, this_val=UNDEFINED):
        if isinstance(func, BuiltinFunction):
            return func(self, this_val, args)
        elif isinstance(func, JSFunction):
            call_env = Environment(func.closure_env)
            call_env.define('this', func.this_val if func.is_arrow or func.this_val is not None else this_val)
            func_vars = set()
            if isinstance(func.body, dict) and 'body' in func.body:
                scan_vars(func.body['body'], func_vars)
            for name in func_vars:
                call_env.define(name, UNDEFINED, 'var')
            for i, param in enumerate(func.params):
                if param['type'] == 'RestElement':
                    rest_args = args[i:]
                    self.bind_pattern(param['argument'], rest_args, call_env, 'let')
                    break
                else:
                    arg_val = args[i] if i < len(args) else UNDEFINED
                    self.bind_pattern(param, arg_val, call_env, 'let')
            if func.is_arrow and func.expr_body:
                return self.eval(func.body, call_env)
            try:
                self.exec_block(func.body['body'], call_env, new_scope=False)
            except ReturnSignal as r:
                return r.value
            return UNDEFINED
        raise ThrowSignal("Callee is not a function")

    def bind_pattern(self, pattern, value, env, kind='var'):
        if pattern['type'] == 'Identifier':
            env.define(pattern['name'], value, kind)
        elif pattern['type'] == 'ArrayPattern':
            elements = pattern['elements']
            for i, el in enumerate(elements):
                if el is None:
                    continue
                if el['type'] == 'RestElement':
                    rest_val = value[i:] if isinstance(value, list) else []
                    self.bind_pattern(el['argument'], rest_val, env, kind)
                    break
                else:
                    el_val = value[i] if (isinstance(value, list) and i < len(value)) else UNDEFINED
                    self.bind_pattern(el, el_val, env, kind)
        elif pattern['type'] == 'ObjectPattern':
            props = pattern['properties']
            consumed_keys = set()
            for prop in props:
                if prop.get('type') == 'RestElement':
                    rest_dict = {k: v for k, v in value.items() if k not in consumed_keys} if isinstance(value, dict) else {}
                    self.bind_pattern(prop['argument'], rest_dict, env, kind)
                else:
                    if prop['computed']:
                        key_val = to_string(self.eval(prop['key'], env))
                    elif prop['key']['type'] == 'Identifier':
                        key_val = prop['key']['name']
                    else:
                        key_val = to_string(prop['key']['value'])
                    consumed_keys.add(key_val)
                    prop_val = value.get(key_val, UNDEFINED) if isinstance(value, dict) else UNDEFINED
                    self.bind_pattern(prop['value'], prop_val, env, kind)
        elif pattern['type'] == 'AssignmentPattern':
            val = value if value is not UNDEFINED else self.eval(pattern['right'], env)
            self.bind_pattern(pattern['left'], val, env, kind)

    def assign_to(self, target, value, env):
        if target['type'] == 'Identifier':
            env.set(target['name'], value)
        elif target['type'] == 'MemberExpression':
            obj = self.eval(target['object'], env)
            if target['computed']:
                prop = to_string(self.eval(target['property'], env))
            else:
                prop = target['property']['name']
            if isinstance(obj, dict):
                obj[prop] = value
            elif isinstance(obj, list):
                obj[int(to_number(prop))] = value
        elif target['type'] == 'ArrayPattern' or target['type'] == 'ObjectPattern':
            self.bind_pattern(target, value, env)

    # -------------------- execution --------------------
    def exec_block(self, body, env, new_scope=True):
        if new_scope:
            env = Environment(env)
        for stmt in body:
            if stmt['type'] == 'FunctionDeclaration':
                env.define(stmt['name'], JSFunction(stmt['name'], stmt['params'], stmt['body'], env))
        for stmt in body:
            if stmt['type'] != 'FunctionDeclaration':
                self.exec_statement(stmt, env)
        return env

    def exec_statement(self, node, env, labels=None):
        t = node['type']
        if t == 'ExpressionStatement':
            self.eval(node['expression'], env)
        elif t == 'VariableDeclaration':
            kind = node['kind']
            for decl in node['declarations']:
                value = self.eval(decl['init'], env) if decl['init'] is not None else UNDEFINED
                self.bind_pattern(decl['id'], value, env, kind)
        elif t == 'BlockStatement':
            self.exec_block(node['body'], env, new_scope=True)
        elif t == 'IfStatement':
            if to_boolean(self.eval(node['test'], env)):
                self.exec_statement(node['consequent'], env)
            elif node['alternate'] is not None:
                self.exec_statement(node['alternate'], env)
        elif t == 'ForStatement':
            self.exec_for(node, env, labels)
        elif t == 'WhileStatement':
            while to_boolean(self.eval(node['test'], env)):
                body_env = Environment(env)
                try:
                    self.exec_statement(node['body'], body_env)
                except BreakSignal as b:
                    if b.label is None or (labels and b.label in labels):
                        break
                    else:
                        raise
                except ContinueSignal as c:
                    if c.label is None or (labels and c.label in labels):
                        continue
                    else:
                        raise
        elif t == 'DoWhileStatement':
            while True:
                body_env = Environment(env)
                try:
                    self.exec_statement(node['body'], body_env)
                except BreakSignal as b:
                    if b.label is None or (labels and b.label in labels):
                        break
                    else:
                        raise
                except ContinueSignal as c:
                    if c.label is None or (labels and c.label in labels):
                        pass
                    else:
                        raise
                if not to_boolean(self.eval(node['test'], env)):
                    break
        elif t == 'ForOfStatement':
            self.exec_for_of(node, env, labels)
        elif t == 'ForInStatement':
            self.exec_for_in(node, env, labels)
        elif t == 'ReturnStatement':
            val = self.eval(node['argument'], env) if node['argument'] is not None else UNDEFINED
            raise ReturnSignal(val)
        elif t == 'BreakStatement':
            label_name = node['label']['name'] if node.get('label') else None
            raise BreakSignal(label_name)
        elif t == 'ContinueStatement':
            label_name = node['label']['name'] if node.get('label') else None
            raise ContinueSignal(label_name)
        elif t == 'SwitchStatement':
            self.exec_switch(node, env, labels)
        elif t == 'TryStatement':
            self.exec_try(node, env)
        elif t == 'ThrowStatement':
            raise ThrowSignal(self.eval(node['argument'], env))
        elif t == 'ClassDeclaration':
            self.exec_class_decl(node, env)
        elif t == 'FunctionDeclaration':
            pass  # already hoisted
        elif t == 'EmptyStatement':
            pass
        elif t == 'LabeledStatement':
            label_name = node['label']['name']
            if labels is None:
                labels = []
            new_labels = labels + [label_name]
            try:
                self.exec_statement(node['body'], env, labels=new_labels)
            except BreakSignal as b:
                if b.label == label_name:
                    pass
                else:
                    raise
        else:
            raise Exception(f'Unknown statement type: {t}')

    def exec_for(self, node, env, labels=None):
        cur_env = Environment(env)
        if node['init'] is not None:
            self.exec_statement(node['init'], cur_env)
        while True:
            iter_env = Environment(env)
            iter_env.vars = dict(cur_env.vars)
            iter_env.consts = set(cur_env.consts)
            if node['test'] is not None and not to_boolean(self.eval(node['test'], iter_env)):
                break
            body_env = Environment(iter_env)
            try:
                self.exec_statement(node['body'], body_env)
            except BreakSignal as b:
                if b.label is None or (labels and b.label in labels):
                    break
                else:
                    raise
            except ContinueSignal as c:
                if c.label is None or (labels and c.label in labels):
                    pass
                else:
                    raise
            if node['update'] is not None:
                self.eval(node['update'], iter_env)
            cur_env = iter_env

    def get_iterable_items(self, val):
        if isinstance(val, list):
            return list(val)
        if isinstance(val, str):
            return list(val)
        if isinstance(val, dict):
            if '__set_items__' in val:
                return list(val['__set_items__'])
            if '__map_entries__' in val:
                return [list(e) for e in val['__map_entries__']]
            return list(val.values())
        raise ThrowSignal(to_string(val) + ' is not iterable')

    def exec_for_of(self, node, env, labels=None):
        right_val = self.eval(node['right'], env)
        items = self.get_iterable_items(right_val)
        left = node['left']
        for item in items:
            iter_env = Environment(env)
            if left['type'] == 'VariableDeclaration':
                target = left['declarations'][0]['id']
                kind = left['kind']
            else:
                target = left
                kind = None
            if kind:
                self.bind_pattern(target, item, iter_env, kind)
            else:
                self.assign_to(target, item, iter_env)
            body_env = Environment(iter_env)
            try:
                self.exec_statement(node['body'], body_env)
            except BreakSignal as b:
                if b.label is None or (labels and b.label in labels):
                    break
                else:
                    raise
            except ContinueSignal as c:
                if c.label is None or (labels and c.label in labels):
                    continue
                else:
                    raise

    def exec_for_in(self, node, env, labels=None):
        right_val = self.eval(node['right'], env)
        if isinstance(right_val, list):
            keys = [str(i) for i in range(len(right_val))]
        elif isinstance(right_val, dict):
            keys = list(right_val.keys())
        else:
            keys = []
        left = node['left']
        for key in keys:
            iter_env = Environment(env)
            if left['type'] == 'VariableDeclaration':
                target = left['declarations'][0]['id']
                kind = left['kind']
            else:
                target = left
                kind = None
            if kind:
                self.bind_pattern(target, key, iter_env, kind)
            else:
                self.assign_to(target, key, iter_env)
            body_env = Environment(iter_env)
            try:
                self.exec_statement(node['body'], body_env)
            except BreakSignal as b:
                if b.label is None or (labels and b.label in labels):
                    break
                else:
                    raise
            except ContinueSignal as c:
                if c.label is None or (labels and c.label in labels):
                    continue
                else:
                    raise

    def exec_switch(self, node, env, labels=None):
        sw_env = Environment(env)
        disc = self.eval(node['discriminant'], sw_env)
        cases = node['cases']
        match_idx = None
        for i, case in enumerate(cases):
            if case['test'] is not None and strict_eq(disc, self.eval(case['test'], sw_env)):
                match_idx = i
                break
        if match_idx is None:
            for i, case in enumerate(cases):
                if case['test'] is None:
                    match_idx = i
                    break
        if match_idx is not None:
            try:
                for i in range(match_idx, len(cases)):
                    for stmt in cases[i]['consequent']:
                        self.exec_statement(stmt, sw_env)
            except BreakSignal as b:
                if b.label is None or (labels and b.label in labels):
                    pass
                else:
                    raise

    def exec_try(self, node, env):
        try:
            try:
                self.exec_block(node['block']['body'], env, new_scope=True)
            except ThrowSignal as e:
                if node['handler']:
                    catch_env = Environment(env)
                    if node['handler']['param']:
                        self.bind_pattern(node['handler']['param'], e.value, catch_env, 'let')
                    self.exec_block(node['handler']['body']['body'], catch_env, new_scope=False)
                else:
                    raise
        finally:
            if node['finalizer']:
                self.exec_block(node['finalizer']['body'], env, new_scope=True)

    def exec_class_decl(self, node, env):
        methods = {}
        for m in node['body']:
            methods[m['name']] = {'params': m['params'], 'body': m['body'], 'static': m['static']}
        superclass = None
        if node['superclass']:
            superclass = self.eval(node['superclass'], env)
        cls = JSClass(node['name'], methods, superclass, env) if False else JSClass(node['name'], methods, superclass)
        cls.def_env = env
        env.define(node['name'], cls)


def js_parseFloat(val):
    s = to_string(val).strip()
    m = re.match(r'^[+-]?(\d+\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?|Infinity)', s)
    if not m:
        return float('nan')
    text = m.group(0)
    if 'Infinity' in text:
        return float('-inf') if text.startswith('-') else float('inf')
    try:
        return float(text)
    except ValueError:
        return float('nan')


def js_parseInt(args):
    s = to_string(args[0]).strip() if args else ''
    radix = int(to_number(args[1])) if len(args) > 1 and args[1] is not None and to_number(args[1]) != 0 else 10
    neg = False
    if s.startswith('+'):
        s = s[1:]
    elif s.startswith('-'):
        neg = True
        s = s[1:]
    if radix == 16 and s.lower().startswith('0x'):
        s = s[2:]
    elif radix == 10 and s.lower().startswith('0x'):
        radix = 16
        s = s[2:]
    digits = '0123456789abcdefghijklmnopqrstuvwxyz'[:radix]
    m = re.match('^[' + re.escape(digits) + ']+', s, re.IGNORECASE)
    if not m:
        return float('nan')
    val = int(m.group(0), radix)
    return -float(val) if neg else float(val)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python interpreter.py file.js")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        source = f.read()

    interp = Interpreter()

    try:
        interp.run(source)
    except Exception as e:
        print("Runtime Error:", e)