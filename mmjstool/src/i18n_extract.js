// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');

const FileHound = require('filehound');

const Parser = require('flow-parser');
const walk = require('estree-walk');

export function extractFromDirectory(dirPaths, filters = []) {
    return new Promise((resolve) => {
        const promises = dirPaths.map((dirPath) => {
            return new Promise((innerResolve) => {
                const translations = {};
                FileHound.create().
                    paths(dirPath).
                    discard(filters).
                    ext('js', 'jsx').
                    find().
                    then((files) => {
                        for (const file of files) {
                            try {
                                Object.assign(translations, extractFromFile(file));
                            } catch (e) {
                                console.log('Unable to parse file:', file);
                                console.log('Error in: line', e.loc && e.loc.line, 'column', e.loc && e.loc.column);
                                return;
                            }
                        }
                        innerResolve(translations);
                    });
            });
        });

        Promise.all(promises).then((translations) => {
            resolve(Object.assign({}, ...translations));
        });
    });
}

function extractFromFile(path) {
    const translations = {};

    var code = fs.readFileSync(path, 'utf-8');
    const ast = Parser.parse(code, {
        esproposal_class_static_fields: true,
        esproposal_class_instance_fields: true,
        esproposal_optional_chaining: true,
    });

    walk(ast, {
        CallExpression: (node) => {
            if ((node.callee.type === 'MemberExpression' && node.callee.property.name === 'localizeMessage') ||
                node.callee.name === 'localizeMessage') {
                const id = node.arguments[0] && node.arguments[0].value;
                const defaultMessage = node.arguments[1] && node.arguments[1].value;

                if (id && id !== '') {
                    translations[id] = defaultMessage;
                } else {
                    // console.log(node.arguments);
                }
            } else if ((node.callee.type === 'MemberExpression' && node.callee.property.name === 'formatMessage') ||
                node.callee.name === 'formatMessage') {
                if (node.arguments && node.arguments[0] && node.arguments[0].properties) {
                    let id = '';
                    let defaultMessage = '';

                    for (const prop of node.arguments[0].properties) {
                        // let prop = node.arguments[0].properties[idx]
                        if (prop.value && prop.key && prop.key.name === 'id') {
                            id = prop.value.value;
                        }
                        if (prop.value && prop.key && prop.key.name === 'defaultMessage') {
                            defaultMessage = prop.value.value;
                        }
                    }
                    if (id && id !== '') {
                        translations[id] = defaultMessage;
                    }
                }
            } else if (node.callee.name === 't') {
                const id = node.arguments[0] && node.arguments[0].value;
                translations[id] = '';
            }
        },
        JSXOpeningElement: (node) => {
            if (node.name.name === 'FormattedText' || node.name.name === 'FormattedMessage' || node.name.name === 'FormattedHTMLMessage' || node.name.name === 'FormattedMarkdownMessage' || node.name.name === 'FormattedMarkdownText' || node.name.name === 'FormattedAdminHeader') {
                let id = '';
                let defaultMessage = '';
                for (var attribute of node.attributes) {
                    if (attribute.value && attribute.value.expression && attribute.name && attribute.name.name === 'id') {
                        id = attribute.value.expression.value;
                    }
                    if (attribute.value && attribute.value.value && attribute.name && attribute.name.name === 'id') {
                        id = attribute.value.value;
                    }
                    if (attribute.value && attribute.value.expression && attribute.name && attribute.name.name === 'defaultMessage') {
                        defaultMessage = attribute.value.expression.value;
                    }
                    if (attribute.value && attribute.value.value && attribute.name && attribute.name.name === 'defaultMessage') {
                        defaultMessage = attribute.value.value;
                    }
                }

                if (id && id !== '') {
                    translations[id] = defaultMessage;
                }
            }
        },
    });
    return translations;
}
