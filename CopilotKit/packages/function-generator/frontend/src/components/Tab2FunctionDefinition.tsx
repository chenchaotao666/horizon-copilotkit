import React from 'react';
import { ProCard } from '@ant-design/pro-components';
import { Button, Space, Row, Col, message } from 'antd';
import { ExportOutlined, DatabaseOutlined, PlayCircleOutlined } from '@ant-design/icons';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { storeToRAG, exportFile } from '../services/api';

interface Tab2Props {
  functionDefinition: string;
  ragRequest: string;
  functionType: string;
  onFunctionDefinitionChange: (value: string) => void;
  onRagRequestChange: (value: string) => void;
}

const Tab2FunctionDefinition: React.FC<Tab2Props> = ({
  functionDefinition,
  ragRequest,
  functionType,
  onFunctionDefinitionChange,
  onRagRequestChange,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [ragLoading, setRagLoading] = React.useState(false);

  const convertJSTypeToParameterType = (jsType: string) => {
    const typeMapping: Record<string, string> = {
      "string": "STRING",
      "number": "NUMBER", 
      "boolean": "BOOLEAN",
      "object": "OBJECT",
      "array": "ARRAY"
    };
    return typeMapping[jsType?.toLowerCase()] || "STRING";
  };

  const convertJSParametersToRAG = (jsParams: any) => {
    const parameters: any = {};
    
    if (!jsParams || jsParams.type !== "object") {
      return parameters;
    }
    
    const properties = jsParams.properties || {};
    const requiredFields = jsParams.required || [];
    
    for (const [paramName, paramDef] of Object.entries(properties)) {
      const def = paramDef as any;
      const paramType = convertJSTypeToParameterType(def.type || "string");
      const description = def.description || `${paramName} 参数`;
      const required = requiredFields.includes(paramName);
      const defaultValue = def.default;
      const enumValues = def.enum;
      
      const parameter: any = {
        type: paramType,
        description: description,
        required: required
      };
      
      if (defaultValue !== undefined) {
        parameter.default = defaultValue;
      }
      
      if (enumValues) {
        parameter.enum = enumValues;
      }
      
      if (paramType === "ARRAY" && def.items) {
        if (def.items.enum) {
          parameter.items = { enum: def.items.enum };
        }
      }
      
      parameters[paramName] = parameter;
    }
    
    return parameters;
  };

  const generateActionExamples = (name: string) => {
    const examples = [];
    
    examples.push({
      input: `'执行${name}动作'`,
      output: `'${name}动作执行完成'`,
      context: `调用${name}进行自动化操作`
    });
    
    return examples;
  };

  const generateActionImplementation = (actionDef: any) => {
    const implementation = {
      action_type: "playwright_script",
      function_name: actionDef.name,
      source_file: "generated_function.js",
      parameters_schema: actionDef.parameters || {},
      usage: `调用 Playwright 脚本执行 ${actionDef.name} 动作`
    };
    
    return JSON.stringify(implementation, null, 2);
  };

  const handleGenerateRAG = () => {
    try {
      if (!functionDefinition) {
        message.warning('请先生成Function定义');
        return;
      }

      // 尝试解析Function Definition
      let parsedFunction;
      try {
        // 如果functionDefinition是JS代码，尝试提取其中的定义
        if (typeof functionDefinition === 'string' && functionDefinition.includes('export')) {
          // 提取 export const xxxDefinition = { ... }; 中的对象
          const match = functionDefinition.match(/export\s+const\s+\w+Definition\s*=\s*({[\s\S]*?});/);
          if (match) {
            // 简单的JS对象到JSON转换（这里可能需要更复杂的处理）
            let objStr = match[1];
            // 基本的JS到JSON转换
            objStr = objStr.replace(/(\w+):/g, '"$1":');
            objStr = objStr.replace(/'/g, '"');
            parsedFunction = JSON.parse(objStr);
          } else {
            throw new Error('无法解析Function定义');
          }
        } else {
          parsedFunction = JSON.parse(functionDefinition);
        }
      } catch (e) {
        // 如果解析失败，创建一个基本的定义
        parsedFunction = {
          name: "generated_function",
          description: "自动生成的函数",
          parameters: {}
        };
      }

      // 根据script_actions_import.py的逻辑生成RAG Request
      const name = parsedFunction.name || "generated_function";
      const description = parsedFunction.description || "自动生成的Playwright脚本函数";
      const category = functionType;
      
      // 转换参数
      const jsParameters = parsedFunction.parameters || {};
      const parameters = convertJSParametersToRAG(jsParameters);
      
      // 生成实现说明
      const implementation = generateActionImplementation(parsedFunction);

      // 构建符合AddFunctionRequest格式的RAG Request
      const ragRequest = {
        name: name,
        category: category,
        description: description,
        parameters: parameters,
        implementation: implementation,
        subcategory: "",
        use_cases: [],
        examples: [],
        dependencies: [],
        tags: [],
      };

      onRagRequestChange(JSON.stringify(ragRequest, null, 2));
      message.success('RAG Request 生成成功！');
    } catch (error) {
      console.error('Generate RAG error:', error);
      message.error('生成RAG Request失败: ' + error);
    }
  };

  const handleStoreToRAG = async () => {
    if (!ragRequest) {
      message.warning('请先生成RAG Request');
      return;
    }

    setRagLoading(true);
    try {
      const ragData = JSON.parse(ragRequest);
      
      // 验证必需字段
      if (!ragData.name || !ragData.category) {
        message.error('RAG Request数据不完整，请重新生成');
        return;
      }
      
      const response = await storeToRAG(ragData);
      
      if (response.success) {
        const successMsg = response.function_id 
          ? `成功存储到RAG数据库！函数ID: ${response.function_id}`
          : '成功存储到RAG数据库！';
        message.success(successMsg);
      } else {
        message.error('存储到RAG失败');
      }
    } catch (error: any) {
      console.error('Store to RAG error:', error);
      
      // 更详细的错误处理
      if (error.response?.data?.error) {
        message.error(`存储失败: ${error.response.data.error}`);
      } else if (error.message?.includes('JSON')) {
        message.error('RAG Request格式错误，请重新生成');
      } else {
        message.error('存储到RAG失败，请检查网络连接和RAG服务状态');
      }
    } finally {
      setRagLoading(false);
    }
  };

  const handleExport = async () => {
    if (!functionDefinition) {
      message.warning('没有可导出的内容');
      return;
    }

    setLoading(true);
    try {
      const blob = await exportFile('function', 'js');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'function-definition.js';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('文件导出成功！');
    } catch (error) {
      console.error('Export error:', error);
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProCard headerBordered>
      <Row gutter={16}>
        <Col span={24}>
          <ProCard 
            title="LLM Function定义" 
            size="small"
            extra={
              <Space>
                <Button 
                  type="primary" 
                  icon={<PlayCircleOutlined />}
                  onClick={handleGenerateRAG}
                >
                  生成RAG Request
                </Button>
                <Button 
                  icon={<ExportOutlined />}
                  loading={loading}
                  onClick={handleExport}
                >
                  导出文件
                </Button>
              </Space>
            }
          >
            <CodeMirror
              value={functionDefinition}
              height="350px"
              extensions={[javascript()]}
              theme={oneDark}
              onChange={onFunctionDefinitionChange}
              placeholder="LLM Function定义将在生成后显示在这里..."
            />
          </ProCard>
        </Col>
      </Row>
      
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={24}>
          <ProCard 
            title="RAG Request" 
            size="small"
            extra={
              <Space>
                <Button 
                  type="primary" 
                  icon={<DatabaseOutlined />}
                  loading={ragLoading}
                  onClick={handleStoreToRAG}
                >
                  入库RAG
                </Button>
              </Space>
            }
          >
            <CodeMirror
              value={ragRequest}
              height="200px"
              extensions={[json()]}
              theme={oneDark}
              onChange={onRagRequestChange}
              placeholder="RAG Request JSON将在生成后显示在这里..."
            />
          </ProCard>
        </Col>
      </Row>
    </ProCard>
  );
};

export default Tab2FunctionDefinition;