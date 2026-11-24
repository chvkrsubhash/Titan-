import {useRef,useState} from 'react'
import {EditorContent,useEditor,type Editor,type JSONContent} from '@tiptap/react'
import {Step} from '@tiptap/pm/transform'
import type {Schema} from '@tiptap/pm/model'
import {extensions} from './extensions'
import {richExtensions} from './advanced'
import {Modal} from './App'
import type {Doc} from './store'

type Proposal={id:string;author:string;created:string;base:JSONContent;steps:Record<string,unknown>[]}
export function applyProposal(editor:Editor,base:JSONContent,steps:Proposal['steps']){
 if(!editor.state.doc.eq(editor.schema.nodeFromJSON(base)))throw Error('The source text changed. Review the proposal against the current document before making a new suggestion.')
 const tr=editor.state.tr
 for(const raw of steps)tr.step(Step.fromJSON(editor.schema,raw))
 editor.view.dispatch(tr)
}
function preview(schema:Schema,p:Proposal){
 let node=schema.nodeFromJSON(p.base)
 for(const raw of p.steps){const result=Step.fromJSON(schema,raw).apply(node);if(!result.doc)throw Error('Invalid suggestion');node=result.doc}
 return node.textBetween(0,node.content.size,'\n')
}
export function Suggestions({editor,doc,update,author,close}:{editor:Editor,doc:Doc,update:(c:Partial<Doc>)=>void,author:string,close:()=>void}){
 const [draft,start]=useState(false),[message,notify]=useState('')
 const items:Proposal[]=doc.settings.suggestions||[]
 function save(proposals:Proposal[]){update({settings:{...doc.settings,suggestions:proposals}})}
 if(draft)return <ProposalEditor initial={editor.getJSON()} cancel={()=>start(false)} submit={(base,steps)=>{save([...items,{id:crypto.randomUUID(),author:author||'You',created:new Date().toISOString(),base,steps}]);start(false)}}/>
 return <Modal title="Suggested changes" close={close}><button className="primary" onClick={()=>start(true)}>Suggest an edit</button>{!items.length&&<p>No pending suggestions.</p>}{items.map(p=><section className="proposal" key={p.id}><b>{p.author}</b> · {new Date(p.created).toLocaleString()}<details><summary>Review proposed text</summary><div className="comparison"><section><b>Original</b><p>{editor.schema.nodeFromJSON(p.base).textContent}</p></section><section><b>Proposed</b><p>{preview(editor.schema,p)}</p></section></div></details><button onClick={()=>{try{applyProposal(editor,p.base,p.steps);save(items.filter(v=>v.id!==p.id));notify('Suggestion accepted.')}catch(ex){notify(String(ex))}}}>Accept</button><button onClick={()=>save(items.filter(v=>v.id!==p.id))}>Reject</button></section>)}{message&&<p role="status">{message}</p>}</Modal>
}
function ProposalEditor({initial,cancel,submit}:{initial:JSONContent,cancel:()=>void,submit:(base:JSONContent,steps:Proposal['steps'])=>void}){
 const base=useRef(initial),steps=useRef<Proposal['steps']>([]),[changed,change]=useState(false)
 const draft=useEditor({extensions:[...extensions,...richExtensions.filter(ext=>ext.name!=='PaginationPlus')],content:base.current,editorProps:{attributes:{'aria-label':'Proposed document text',role:'textbox'}},onTransaction:({transaction})=>{if(transaction.docChanged){steps.current.push(...transaction.steps.map(step=>step.toJSON()));change(true)}}},[])
 return <Modal title="Draft a suggestion" close={cancel}><p>Edit the draft and submit it for review.</p><div className="proposal-editor"><EditorContent editor={draft}/></div><button className="primary" disabled={!changed} onClick={()=>submit(base.current,steps.current)}>Submit proposed changes</button></Modal>
}
