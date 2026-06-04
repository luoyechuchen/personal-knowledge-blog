高频用llm的都知道，现在aichat已经属于基础功能了，开个ChatGPTplus，5.5thinking随便用，不存在用完的额度焦虑问题。然而几乎所有能用chatbot解决的问题，都能用codex这类agent解决，而chatbot解决不了的问题，例如需要调用multithreading的任务，或者说，对于所有非纯逻辑推理/简单数据检索的任务，agent都比chatbot强。甚至这种限制也是保守的，因为模型能力到了某个阈值以后，scaffolding / tool use / memory / execution loop 比单次回答质量更重要。不过无可争议的是，agent一定是下一代主战场。
agent 会吃掉大量传统 SaaS，因为很多 SaaS 的核心价值其实只是把一套流程包装成 UI。
但如果 agent 能直接操作codebase、database、document、browser、API，那么 UI 的价值会下降，workflow 本身会被 agent 接管。
所以软件公司，如果不能找到区别于agent的独特价值，那么都将被agent所取代。
软件工程师这个岗位，也只剩很短的一个时间窗口了，或者说，Junior Software Engineer / Junior Developer 岗位很快都会消失，因为没有公司会愿意training entry-level talent from scratch了。
这就是为什么OpenAI坚持要把codex做成超级app。
今天还在把 LLM 当chatbot用的人，最多只用了 10% 的能力。换个角度看，一个新的software需求窗口期已经出现，不过预估其持续最多只有一两年。
黄仁勋：“AI在六个月前才刚刚变得高效和有用，怎么可能两年前就有人因为AI而裁员了呢？”
请从反面思考这句话