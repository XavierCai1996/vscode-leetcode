// Licensed under the MIT license.

import * as vscode from "vscode";
import * as fse from "fs-extra";
import * as path from "path";
import { Debugger } from "./debugger";

interface IArgumentMetaInfo {
    type: string;
    name: string;
}

interface IFunctionMetaInfo {
    name: string;
    args: IArgumentMetaInfo[];
    type: string;
}

interface IProblemMetaInfo {
    name: string; // class name
    functions: IFunctionMetaInfo[];
    isDesignProblem: boolean;
    isInteractiveProblem: boolean;
}

export class CppDebugger extends Debugger {
    private solutionFilePath: string;
    private definitionFilePath: string;
    private mainFilePath: string;

    public async init(solutionEditor: vscode.TextEditor, codeTemplate: string): Promise<string | undefined> {
        if (!solutionEditor || solutionEditor.document.isClosed || !codeTemplate) {
            return;
        }

        this.solutionFilePath = solutionEditor.document.uri.fsPath;
        const folder: string = path.dirname(this.solutionFilePath);
        this.definitionFilePath = path.join(folder, "definition.h");
        this.mainFilePath = path.join(folder, "leetcode-cpp-debug.cpp");

        // insert include code to solution file
        const insertContent: string = "#include \"" + path.basename(this.definitionFilePath) + "\"\n";
        const editResult: boolean = await solutionEditor.edit((editor: vscode.TextEditorEdit) => editor.insert(new vscode.Position(0, 0), insertContent));
        if (!editResult) {
            return;
        }

        await this.genDefinitionFile();
        await this.genMainFile(codeTemplate);

        return this.mainFilePath;
    }

    public async dispose(solutionEditor: vscode.TextEditor): Promise<void> {
        // remove inserted include code
        if (solutionEditor.document.isClosed) {
            return;
        }
        await solutionEditor.edit((editor: vscode.TextEditorEdit) => { editor.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 0))); });
    }

    private getMetaInfo(code: string): IProblemMetaInfo {
        const meta: IProblemMetaInfo = {
            name: '',
            functions: [],
            isDesignProblem: false,
            isInteractiveProblem: false
        }

        const classPattern: RegExp = /class (Solution|[\w\d]+) {/;
        const initPattern: RegExp = / *([\w\d]+) *\((([, ]*[\w\d<>\*]+[ \*&]+[\w\d]+)*)\)[ \{\}]*/;
        const funcPattern: RegExp = / *([\w\d<>\*]+) +([\w\d]+) *\((([, ]*[\w\d<>\*]+[ \*&]+[\w\d]+)*)\)[ \{\}]*/;
        const argPattern: RegExp = / *([\w\d<>\*]+ *\*?) *&? *([\w\d]+) */;

        function getArgMetaInfo(arg: string): IArgumentMetaInfo {
            const match: RegExpExecArray | null = argPattern.exec(arg);
            if (match) {
                return { type: match[1], name: match[2] };
            }
            (function (): never {
                throw `Can not get ArgMetaInfo from ${arg}`;
            })();
        }
        function getFuncMetaInfo(line: string): IFunctionMetaInfo | undefined {
            function normalize(type: string, name: string, args: string): IFunctionMetaInfo {
                const ret: IFunctionMetaInfo = {
                    name: name,
                    args: [],
                    type: type
                };
                const values = args.split(',');
                for (const value of values) {
                    ret.args.push(getArgMetaInfo(value));
                }
                return ret;
            }

            if (meta.name.length > 0) {
                const match: RegExpExecArray | null = initPattern.exec(line);
                if (match && match[1] == meta.name) {
                    return normalize('void', match[1], match[2]);
                }
            }
            const match: RegExpExecArray | null = funcPattern.exec(line);
            if (!match) {
                return;
            }
            return normalize(match[1], match[2], match[3]);
        }

        const lines: string[] = code.split('\n');
        for (const line of lines) {
            //vscode.window.showInformationMessage(`${line}`);
            if (meta.name.length <= 0) {
                const match: RegExpExecArray | null = classPattern.exec(line);
                if (match) {
                    meta.name = match[1];
                    meta.isDesignProblem = meta.name != 'Solution';
                }
            }
            else {
                const func: IFunctionMetaInfo | undefined = getFuncMetaInfo(line);
                if (func) {
                    meta.functions.push(func);
                }
            }
        }
        return meta;
    }

    private async genDefinitionFile(): Promise<void> {
        if (!this.definitionFilePath) {
            return;
        }

        if (!await fse.pathExists(this.definitionFilePath)) {
            await fse.createFile(this.definitionFilePath);
        }

        const definition: string = " \n \
        #ifndef LEETCODE_DEFINITION \n \
        #define LEETCODE_DEFINITION \n \
        #include <bits/stdc++.h> \n \
        using namespace std; \n \
        struct ListNode { \n \
        public: \n \
            int val; \n \
            ListNode *next; \n \
            ListNode(int x) : val(x), next(NULL) {} \n \
        private: \n \
            static list<ListNode*> all_; \n \
            friend class MemoryCleaner; \n \
        }; \n \
        list<ListNode*> ListNode::all_; \n \
        \n \
        struct TreeNode { \n \
        public: \n \
            int val; \n \
            TreeNode *left; \n \
            TreeNode *right; \n \
            TreeNode(int x) : val(x), left(NULL), right(NULL) {} \n \
        private: \n \
            static list<TreeNode*> all_; \n \
            friend class MemoryCleaner; \n \
        }; \n \
        list<TreeNode*> TreeNode::all_; \n \
        #endif \n \
        "
        await fse.writeFile(this.definitionFilePath, definition);
    }

    private async genMainFile(code: string): Promise<void> {
        if (!this.mainFilePath) {
            return;
        }

        if (!await fse.pathExists(this.mainFilePath)) {
            await fse.createFile(this.mainFilePath);
        }
        const fp: number = await fse.open(this.mainFilePath, "w");

        function output(data: string): void {
            fse.writeSync(fp, data);
        }

        output("#include \"" + path.basename(this.definitionFilePath) + "\"\n");
        output("#include \"" + path.basename(this.solutionFilePath) + "\"\n");
        output(" \n \
        struct StringException : public exception { \n \
        public: \n \
            StringException(const char* err) : err_(err) { } \n \
            StringException(const string& err) : err_(err) { } \n \
            const char * what () const throw () { return err_.c_str(); } \n \
        private: \n \
            string err_; \n \
        }; \n \
            \n \
        template <typename _T> \n \
        void join_impl(stringstream& ss, const _T& v) { \n \
            ss << v; \n \
        } \n \
        template <typename _T, typename... _REST> \n \
        void join_impl(stringstream& ss, const _T& v, const _REST &... r) { \n \
            ss << v; \n \
            join_impl(ss, r...); \n \
        } \n \
        template <typename... _T> \n \
        string join(const _T &... v) { \n \
            stringstream ss; \n \
            join_impl(ss, v...); \n \
            return ss.str(); \n \
        } \n \
            \n \
        void assert_msg_impl(int line, bool condition, const string& msg) { \n \
            if (!condition) { \n \
                stringstream ss; \n \
                ss << msg << (msg.length() > 0 ? \" \" : \"\"); \n \
                ss << \"Line: \" << line << endl; \n \
                throw StringException(ss.str()); \n \
            } \n \
        } \n \
        #define assert_msg(...) assert_msg_impl(__LINE__, __VA_ARGS__) \n \
        \n \
        struct Null { } null; \n \
        const string inputFormatError = \"Input format error: \"; \n \
         \n \
        struct MultiOS { \n \
        private: \n \
            vector<ostream*> oss_; \n \
        public: \n \
            MultiOS(vector<ostream*> oss) : oss_(oss) { for (auto os : oss_) os->precision(6); } \n \
            template <typename _T> \n \
            MultiOS& operator << (const _T& v) { for (auto os : oss_) *os << v; return *this; } \n \
            MultiOS& operator << (ostream& (*v)(ostream&)) { for (auto os : oss_) *os << v; return *this; } \n \
        }; \n \
         \n \
        class FormatStream { \n \
        private: \n \
            istream* is_; \n \
            MultiOS* os_; \n \
            int level_; \n \
            void startInput() { \n \
                ++level_; \n \
            } \n \
            FormatStream& endInput() { \n \
                if (--level_ == 0) { \n \
                    char c = is_->get(); \n \
                    assert_msg(c == \'\\n\' || c == EOF, join(inputFormatError, \"bad end of line.\")); \n \
                } \n \
                return *this; \n \
            } \n \
        public: \n \
            FormatStream(istream *is, MultiOS *os) : is_(is), os_(os), level_(0) {} \n \
            template <typename _T> \n \
            FormatStream& operator << (const _T& v) { *os_ << v; return *this; } \n \
            FormatStream& operator << (ostream& (*v)(ostream&)) { *os_ << v; return *this; } \n \
            FormatStream& operator << (const bool& v) { *os_ << (v ? \"true\" : \"false\"); return *this; } \n \
            FormatStream& operator << (const string& s) { *os_ << \'\"\' << s << \'\"\'; return *this; } \n \
            FormatStream& operator << (const Null& v) { *os_ << \"null\"; return *this; } \n \
            template <typename _T> \n \
            FormatStream& operator << (const vector<_T>& v) { \n \
                *os_ << \'[\'; \n \
                for (int i = 0, n = v.size(); i < n; ++i) { \n \
                    if (i != 0) *os_ << \',\'; \n \
                    *this << v[i]; \n \
                } \n \
                *os_ << \']\'; \n \
                return *this; \n \
            } \n \
            FormatStream& operator << (TreeNode* const &node) { \n \
                queue<TreeNode*> Q; \n \
                Q.push(node); \n \
                *os_ << \'[\'; \n \
                bool isFirst = true; \n \
                auto outputComma = [this, &isFirst] { \n \
                    if (isFirst) isFirst = false; \n \
                    else *os_ << \',\'; \n \
                }; \n \
                int nullCount = 0; \n \
                while (!Q.empty()) { \n \
                    TreeNode* cur = Q.front(); \n \
                    Q.pop(); \n \
                    if (cur == NULL) ++nullCount; \n \
                    else { \n \
                        for (; nullCount > 0; --nullCount) { outputComma(); *this << null; }  \n \
                        outputComma(); \n \
                        *os_ << cur->val; \n \
                        Q.push(cur->left); \n \
                        Q.push(cur->right); \n \
                    } \n \
                } \n \
                *os_ << \']\'; \n \
                return *this; \n \
            } \n \
            template <typename _T> \n \
            FormatStream& operator >> (_T& v) { startInput(); *is_ >> v; return endInput(); } \n \
            FormatStream& operator >> (bool& v) { \n \
                startInput(); \n \
                static string ref1 = \"true\", ref2 = \"false\"; \n \
                char ch = is_->peek(); \n \
                assert_msg(ch == \'t\' || ch == \'f\', join(inputFormatError, \"[bool].\")); \n \
                bool flag = ch == \'t\'; \n \
                int len = (flag ? ref1 : ref2).size(); \n \
                for (int i = 0; i < len; ++i) { \n \
                    ch = is_->get(); \n \
                    if (ch != (flag ? ref1 : ref2)[i]) assert_msg(false, join(inputFormatError, \"[bool].\")); \n \
                } \n \
                v = flag; \n \
                return endInput(); \n \
            } \n \
            FormatStream& operator >> (string& s) { \n \
                startInput(); \n \
                char ch = is_->get(); \n \
                if (ch != \'\"\') assert_msg(false, join(inputFormatError, \"[string].\")); \n \
                stringstream ss; \n \
                while (true) { \n \
                    ch = is_->get(); \n \
                    if (ch == \'\"\') break; \n \
                    ss << ch; \n \
                } \n \
                s = ss.str();    \n \
                return endInput(); \n \
            } \n \
            FormatStream& operator >> (Null& v) { \n \
                startInput(); \n \
                static string ref = \"null\"; \n \
                char ch; \n \
                for (int i = 0, n = ref.size(); i < n; ++i) { \n \
                    ch = is_->get(); \n \
                    if (ch != ref[i]) assert_msg(false, join(inputFormatError, \"[null]\")); \n \
                } \n \
                return endInput(); \n \
            } \n \
            template <typename _T> \n \
            FormatStream& operator >> (vector<_T>& v) { \n \
                startInput(); \n \
                v.resize(0); \n \
                char ch = is_->get(); \n \
                if (ch != \'[\') assert_msg(false, join(inputFormatError, \"[vector].\")); \n \
                if (is_->peek() == \']\') { is_->get(); return endInput(); } //empty vector \n \
                while (true) { \n \
                    v.push_back(_T()); \n \
                    *this >> v.back(); \n \
                    *is_ >> ch; \n \
                    if (ch == \']\') break; \n \
                    if (ch != \',\') assert_msg(false, join(inputFormatError, \"[vector].\")); \n \
                } \n \
                return endInput(); \n \
            } \n \
            FormatStream& operator >> (TreeNode* &node) { \n \
                startInput(); \n \
                auto read = [this]() -> TreeNode* { \n \
                    char peek = is_->peek(); \n \
                    if (peek == \']\') return NULL; \n \
                    if (peek == \'n\') { *this >> null; return NULL; } \n \
                    int val; \n \
                    *this >> val; \n \
                    return new TreeNode(val); \n \
                }; \n \
                auto readSeparator = [this]() -> bool { // is \']\' \n \
                    char ch = is_->get(); \n \
                    if (ch == \']\') return true; \n \
                    if (ch != \',\') assert_msg(false, join(inputFormatError, \"[TreeNode].\")); \n \
                    return false; \n \
                }; \n \
                char ch = is_->get(); \n \
                if (ch != \'[\') assert_msg(false, join(inputFormatError, \"[TreeNode].\")); \n \
                node = read(); \n \
                if (readSeparator()) return endInput(); // empty tree \n \
                queue<TreeNode*> Q; \n \
                if (node != NULL) Q.push(node); \n \
                while (!Q.empty()) { \n \
                    TreeNode* cur = Q.front(); \n \
                    Q.pop(); \n \
                    cur->left = read(); \n \
                    if (cur->left != NULL) Q.push(cur->left); \n \
                    if (readSeparator()) break; \n \
                    cur->right = read(); \n \
                    if (cur->right != NULL) Q.push(cur->right); \n \
                    if (readSeparator()) break; \n \
                } \n \
                return endInput(); \n \
            } \n \
            template <typename THIS, size_t I, size_t N, typename... Args> \n \
            struct TupleHelper { \n \
                static void read(THIS& fs, tuple<Args...>& v) { \n \
                    char ch; \n \
                    fs >> get<I>(v) >> ch; \n \
                    if (ch != \',\') assert_msg(false, join(inputFormatError, \"[tuple].\")); \n \
                    TupleHelper<THIS, I+1, N-1, Args...>::read(fs, v); \n \
                } \n \
                static void print(THIS& fs, const tuple<Args...>& v) { \n \
                    fs << get<I>(v) << \',\'; \n \
                    TupleHelper<THIS, I+1, N-1, Args...>::print(fs, v); \n \
                } \n \
            }; \n \
            template <typename THIS, size_t I, typename... Args> \n \
            struct TupleHelper<THIS, I, 1, Args...> { \n \
                static void read(THIS& fs, tuple<Args...>& v) { \n \
                    fs >> get<I>(v); \n \
                } \n \
                static void print(THIS& fs, const tuple<Args...>& v) { \n \
                    fs << get<I>(v); \n \
                } \n \
            }; \n \
            template <typename... Args> \n \
            FormatStream& operator << (const tuple<Args...>& v) { \n \
                *os_ << \'[\'; \n \
                TupleHelper<FormatStream, 0, sizeof...(Args), Args...>::print(*this, v); \n \
                *os_ << \']\'; \n \
                return *this; \n \
            } \n \
            template <typename... Args> \n \
            FormatStream& operator >> (tuple<Args...>& v) { \n \
                startInput(); \n \
                char ch; \n \
                *is_ >> ch; \n \
                if (ch != \'[\') assert_msg(false, join(inputFormatError, \"[tuple].\")); \n \
                TupleHelper<FormatStream, 0, sizeof...(Args), Args...>::read(*this, v); \n \
                *is_ >> ch; \n \
                if (ch != \']\') assert_msg(false, join(inputFormatError, \"[tuple].\")); \n \
                return endInput(); \n \
            } \n \
        }; \n \
         \n \
        class MemoryCleaner { \n \
        public: \n \
            static void clean() { clean(TreeNode::all_); clean(ListNode::all_); } \n \
        private: \n \
            template<typename _T> \n \
            static void clean(list<_T*>& all) { for (auto& p : all) delete p; all.clear(); } \n \
        }; \n \
         \n \
        void test(FormatStream& fs); \n \
         \n \
        void entry() { \n \
            vector<ostream*> oss; \n \
        #ifdef OUTPUT_FILE \n \
            ofstream ofp(OUTPUT_FILE); \n \
            oss.push_back(&ofp); \n \
        #endif \n \
        #ifdef OUTPUT_STD_COUT \n \
            oss.push_back(&cout); \n \
        #endif \n \
            MultiOS os(oss); \n \
        #ifdef INPUT_FILE \n \
            ifstream ifp(INPUT_FILE); \n \
            istream& is = ifp; \n \
            cout << \"Input from file \\\"\" << INPUT_FILE << \"\\\"\" << endl; \n \
        #else \n \
            istream& is = cin; \n \
            cout << \"Input from [std::cin]\" << endl; \n \
        #endif \n \
            FormatStream fs(&is, &os); \n \
            while (is.peek() != EOF) { \n \
                test(fs); \n \
                try { \n \
                    MemoryCleaner::clean(); \n \
                } \n \
                catch (...) { \n \
                    assert_msg(false, \"Please only use pointer of [TreeNode] & [ListNode] and do not use [delete].\"); \n \
                } \n \
            } \n \
        #ifdef OUTPUT_FILE \n \
            ofp.flush(); \n \
            ofp.close(); \n \
        #endif \n \
        #ifdef INPUT_FILE  \n \
            ifp.close(); \n \
        #endif \n \
            cout << \"Program Complete\" << endl; \n \
        } \n \
         \n \
        int main() { \n \
            try { \n \
                entry(); \n \
            } \n \
            catch (StringException e) { \n \
                cerr << e.what() << endl; \n \
            } \n \
            return 0; \n \
        } \n \
        ");

        const meta: IProblemMetaInfo = this.getMetaInfo(code);
        if (meta.name.length <= 0) {
            throw "Invalid meta info.";
        }
        if (meta.isDesignProblem || meta.isInteractiveProblem) {
            throw "Unsupported problem type.";
        }
        if (meta.functions.length > 1) {
            throw "Too much functions in class [Solution].";
        }
        if (meta.functions.length <= 0) {
            throw "Can not find the entry function.";
        }

        const func = meta.functions[0];
        if (func.type == "void") {
            throw "Invalid return type.";
        }

        output("void test(FormatStream& fs) { \n");
        // declaration and input
        for (const arg of func.args) {
            output(arg.type + " " + arg.name + "; \n");
            output("fs >> " + arg.name + "; \n");
        }
        // call the function
        output("Solution solution; \n");
        const names: string[] = [];
        for (const arg of func.args) {
            names.push(arg.name);
        }
        output("fs << solution." + func.name + "(" + names.join(", ") + ") << endl; \n");
        output("} \n");

        await fse.fsync(fp);
        await fse.close(fp);
    }
}
