import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "../api/client";
import { displayValue, recordTitle, toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Row = Record<string, unknown>;
type Option = { id: string; name?: string; code?: string };
type UploadedAsset = { id: string; url: string; publicId?: string | null };
type EventDraft = {
  title: string;
  shortDescription: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  categoryId: string;
  departmentId: string;
  publicationStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isFeatured: boolean;
  coverImageUrl: string;
  coverFileId: string;
};
const today = () => new Date().toISOString().slice(0,10);
const emptyDraft = (): EventDraft => ({
  title:"",shortDescription:"",description:"",eventDate:today(),startTime:"",endTime:"",venue:"",
  categoryId:"",departmentId:"",publicationStatus:"DRAFT",isFeatured:false,coverImageUrl:"",coverFileId:""
});
function object(value: unknown): Row { return value && typeof value==="object"&&!Array.isArray(value)?value as Row:{}; }
function idOf(value: Row): string { return typeof value.id==="string"?value.id:""; }
function text(value: unknown): string { return value===null||value===undefined?"":String(value); }
function errorText(error: unknown): string { return error instanceof ApiError?error.message:error instanceof Error?error.message:"The request failed. Try again."; }
function optionLabel(value: Option): string { const name=value.name||"";const code=value.code||"";return [name||code||"Option",name&&code?code:""].filter(Boolean).join(" · "); }
function eventDraftFrom(row: Row): EventDraft {
  return {
    title:text(row.title),shortDescription:text(row.shortDescription),description:text(row.description),
    eventDate:text(row.eventDate).slice(0,10)||today(),startTime:text(row.startTime),endTime:text(row.endTime),venue:text(row.venue),
    categoryId:text(row.categoryId)||text(object(row.category).id),departmentId:text(row.departmentId)||text(object(row.department).id),
    publicationStatus:(["DRAFT","PUBLISHED","ARCHIVED"].includes(text(row.publicationStatus))?text(row.publicationStatus):"DRAFT") as EventDraft["publicationStatus"],
    isFeatured:row.isFeatured===true,coverImageUrl:text(row.coverImageUrl),coverFileId:text(row.coverFileId)
  };
}

async function chooseImageAndUpload(): Promise<UploadedAsset | null> {
  const result=await DocumentPicker.getDocumentAsync({
    type:["image/jpeg","image/png","image/webp","image/gif"],
    copyToCacheDirectory:true,
    multiple:false
  });
  if(result.canceled||!result.assets?.length)return null;
  const asset=result.assets[0];
  const allowed=["image/jpeg","image/png","image/webp","image/gif"];
  if(!asset.mimeType||!allowed.includes(asset.mimeType))throw new Error("Choose a JPEG, PNG, WebP or GIF image.");
  if(asset.size!==undefined&&asset.size>10*1024*1024)throw new Error("Image must be no larger than 10 MB.");
  const formData=new FormData();
  formData.append("file",{uri:asset.uri,name:asset.name||"event-image",type:asset.mimeType} as unknown as Blob);
  return apiRequest<UploadedAsset>("/events/media/upload",{method:"POST",body:formData});
}

export function EventsScreen() {
  const { user }=useAuth();
  const { context }=useWorkspaceContext();
  const workspaceKey=JSON.stringify(context?.scope??{});
  const client=useQueryClient();
  const permissions=user?.permissions??[];
  const canRead=permissions.includes("events.read");
  const canManage=permissions.includes("events.manage");
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState<"ALL"|"DRAFT"|"PUBLISHED"|"ARCHIVED">("ALL");
  const [selectedId,setSelectedId]=useState("");
  const [editingId,setEditingId]=useState("");
  const [draft,setDraft]=useState<EventDraft>(emptyDraft());
  const [showForm,setShowForm]=useState(false);
  const [showCategoryForm,setShowCategoryForm]=useState(false);
  const [categoryName,setCategoryName]=useState("");
  const [categoryDescription,setCategoryDescription]=useState("");
  const [uploading,setUploading]=useState(false);
  const [formError,setFormError]=useState("");
  const [notice,setNotice]=useState("");

  const listQuery=useQuery({
    queryKey:["events",user?.id,workspaceKey,search,statusFilter],
    queryFn:()=>apiRequest<unknown>("/events?page=1&pageSize=50"+(search.trim()?"&search="+encodeURIComponent(search.trim()):"")+(statusFilter!=="ALL"?"&status="+statusFilter:"")),
    enabled:Boolean(user?.id&&canRead),
    staleTime:0
  });
  const categoriesQuery=useQuery({
    queryKey:["event-options",user?.id,workspaceKey,"categories"],
    queryFn:()=>apiRequest<unknown>("/events/categories"),
    enabled:Boolean(user?.id&&canManage),
    staleTime:0
  });
  const departmentsQuery=useQuery({
    queryKey:["event-options",user?.id,workspaceKey,"departments"],
    queryFn:()=>apiRequest<unknown>("/departments?page=1&pageSize=100"),
    enabled:Boolean(user?.id&&canManage&&permissions.includes("departments.read")),
    staleTime:0
  });
  const rows=useMemo(()=>toCollection(listQuery.data).map(object),[listQuery.data]);
  const categories=useMemo(()=>toCollection(categoriesQuery.data).map(object).filter(v=>typeof v.id==="string") as Option[],[categoriesQuery.data]);
  const departments=useMemo(()=>toCollection(departmentsQuery.data).map(object).filter(v=>typeof v.id==="string") as Option[],[departmentsQuery.data]);
  const selected=rows.find(v=>idOf(v)===selectedId)||null;
  const media=selected&&Array.isArray(selected.media)?selected.media.map(object):[];

  const invalidate=async()=>{
    await Promise.all([
      client.invalidateQueries({queryKey:["events",user?.id]}),
      client.invalidateQueries({queryKey:["event-options",user?.id]}),
      client.invalidateQueries({queryKey:["module",user?.id]}),
      client.invalidateQueries({queryKey:["dashboard-work",user?.id]})
    ]);
  };

  const saveMutation=useMutation({
    mutationFn:async()=>{
      if(!user||!canManage)throw new Error("Your session does not permit event management.");
      if(draft.title.trim().length<2)throw new Error("Event title must contain at least two characters.");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.eventDate)||Number.isNaN(new Date(draft.eventDate+"T12:00:00Z").getTime()))throw new Error("Event date must use YYYY-MM-DD.");
      if(draft.startTime&&draft.endTime&&draft.endTime<=draft.startTime)throw new Error("End time must be after start time.");
      const payload={
        title:draft.title.trim(),
        shortDescription:draft.shortDescription.trim()||null,
        description:draft.description.trim()||null,
        eventDate:new Date(draft.eventDate+"T12:00:00Z").toISOString(),
        startTime:draft.startTime.trim()||null,
        endTime:draft.endTime.trim()||null,
        venue:draft.venue.trim()||null,
        categoryId:draft.categoryId||null,
        departmentId:draft.departmentId||null,
        publicationStatus:draft.publicationStatus,
        isFeatured:draft.isFeatured,
        coverImageUrl:draft.coverImageUrl||null,
        coverFileId:draft.coverFileId||null
      };
      return apiRequest<unknown>(editingId?"/events/"+encodeURIComponent(editingId):"/events",{
        method:editingId?"PATCH":"POST",body:JSON.stringify(payload)
      });
    },
    onSuccess:async()=>{
      setFormError("");setNotice(editingId?"Event updated.":"Event created.");setShowForm(false);setEditingId("");setDraft(emptyDraft());
      await invalidate();
    },
    onError:(error:unknown)=>setFormError(errorText(error))
  });
  const deleteMutation=useMutation({
    mutationFn:async(id:string)=>{
      if(!canManage)throw new Error("Your session does not permit event deletion.");
      return apiRequest<unknown>("/events/"+encodeURIComponent(id),{method:"DELETE"});
    },
    onSuccess:async()=>{setSelectedId("");setNotice("Event deleted.");setFormError("");await invalidate();},
    onError:(error:unknown)=>setFormError(errorText(error))
  });
  const categoryMutation=useMutation({
    mutationFn:async()=>{
      if(!canManage)throw new Error("Your session does not permit category management.");
      if(categoryName.trim().length<2)throw new Error("Category name must contain at least two characters.");
      return apiRequest<unknown>("/events/categories",{method:"POST",body:JSON.stringify({name:categoryName.trim(),description:categoryDescription.trim()||null,isActive:true})});
    },
    onSuccess:async()=>{setCategoryName("");setCategoryDescription("");setShowCategoryForm(false);setNotice("Event category created.");await client.invalidateQueries({queryKey:["event-options",user?.id]});},
    onError:(error:unknown)=>setFormError(errorText(error))
  });

  const beginCreate=()=>{setEditingId("");setDraft(emptyDraft());setFormError("");setNotice("");setShowForm(true);setSelectedId("");};
  const beginEdit=(row:Row)=>{setEditingId(idOf(row));setDraft(eventDraftFrom(row));setFormError("");setNotice("");setShowForm(true);};
  const uploadCover=async()=>{
    setUploading(true);setFormError("");
    try{
      const asset=await chooseImageAndUpload();
      if(asset)setDraft(previous=>({...previous,coverImageUrl:asset.url,coverFileId:asset.id}));
    }catch(error){setFormError(errorText(error));}
    finally{setUploading(false);}
  };
  const addGalleryImage=async()=>{
    if(!selectedId){setFormError("Save or select an event before adding gallery images.");return;}
    if(!canManage){setFormError("Your session does not permit gallery changes.");return;}
    setUploading(true);setFormError("");
    try{
      const asset=await chooseImageAndUpload();
      if(!asset)return;
      await apiRequest<unknown>("/events/"+encodeURIComponent(selectedId)+"/media",{method:"POST",body:JSON.stringify({fileAssetId:asset.id,url:asset.url,publicId:asset.publicId||null,title:text(selected?.title)||null,altText:text(selected?.title)||null})});
      setNotice("Gallery image uploaded and attached.");await invalidate();
    }catch(error){setFormError(errorText(error));}
    finally{setUploading(false);}
  };
  const removeGalleryImage=(mediaId:string)=>{
    Alert.alert("Remove gallery image?","The image will be detached and the server will enforce event-management permission.",[
      {text:"Cancel",style:"cancel"},
      {text:"Remove",style:"destructive",onPress:()=>{void apiRequest<unknown>("/events/media/"+encodeURIComponent(mediaId),{method:"DELETE"}).then(async()=>{setNotice("Gallery image removed.");await invalidate();}).catch((error:unknown)=>setFormError(errorText(error)));}}
    ]);
  };
  const textField=(key:keyof EventDraft,label:string,required=false,multiline=false)=>(
    <View key={key} style={styles.field}><Text style={styles.label}>{label}{required?" *":""}</Text><TextInput accessibilityLabel={label} value={String(draft[key])} onChangeText={value=>setDraft(previous=>({...previous,[key]:value}))} style={[styles.input,multiline?styles.multiline:null]} placeholder={label} placeholderTextColor={colors.textMuted} multiline={multiline} textAlignVertical={multiline?"top":"center"} editable={!saveMutation.isPending&&!uploading}/></View>
  );
  const choice=(label:string,key:"categoryId"|"departmentId",values:Option[],query:{isLoading:boolean;isError:boolean})=>(
    <View style={styles.field}><Text style={styles.label}>{label}</Text>
      {query.isLoading?<Text style={styles.muted}>Loading authorized options…</Text>:query.isError?<Text style={styles.errorText}>Options unavailable. Retry the request before selecting a value.</Text>:<View style={styles.choices}>
        <Pressable accessibilityRole="button" accessibilityState={{selected:!draft[key]}} onPress={()=>setDraft(previous=>({...previous,[key]:""}))} style={[styles.choice,!draft[key]?styles.choiceSelected:null]}><Text style={[styles.choiceText,!draft[key]?styles.choiceSelectedText:null]}>None</Text></Pressable>
        {values.map(value=><Pressable key={value.id} accessibilityRole="button" accessibilityState={{selected:draft[key]===value.id}} onPress={()=>setDraft(previous=>({...previous,[key]:value.id}))} style={[styles.choice,draft[key]===value.id?styles.choiceSelected:null]}><Text style={[styles.choiceText,draft[key]===value.id?styles.choiceSelectedText:null]}>{optionLabel(value)}</Text></Pressable>)}
      </View>}
    </View>
  );

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS==="ios"?"padding":undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={listQuery.isRefetching} onRefresh={()=>{void listQuery.refetch();}} tintColor={colors.primary}/>}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CAMPUS LIFE & CMS</Text><Text style={styles.title}>Events & gallery</Text>
        <Text style={styles.muted}>Events use the existing CMS API, category model, tenant-aware authorization and image storage. Publishing and edits are server validated.</Text>
        <TextInput accessibilityLabel="Search events" value={search} onChangeText={setSearch} style={styles.input} placeholder="Search event title or description" placeholderTextColor={colors.textMuted}/>
        <View style={styles.choices}>{(["ALL","DRAFT","PUBLISHED","ARCHIVED"] as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:statusFilter===value}} onPress={()=>setStatusFilter(value)} style={[styles.choice,statusFilter===value?styles.choiceSelected:null]}><Text style={[styles.choiceText,statusFilter===value?styles.choiceSelectedText:null]}>{value}</Text></Pressable>)}</View>
        {canManage?<View style={styles.actions}><Pressable accessibilityRole="button" onPress={beginCreate} style={styles.primary}><Text style={styles.primaryText}>Create event</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>setShowCategoryForm(value=>!value)} style={styles.secondary}><Text style={styles.secondaryText}>Manage categories</Text></Pressable></View>:null}
      </View>
      {notice?<Text style={styles.success}>{notice}</Text>:null}
      {formError?<View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View>:null}
      {!canRead?<View style={styles.state}><Text style={styles.sectionTitle}>Event read access not granted</Text><Text style={styles.muted}>The session does not include events.read.</Text></View>:null}
      {canRead&&listQuery.isLoading?<View style={styles.state}><ActivityIndicator color={colors.primary}/><Text style={styles.muted}>Loading events…</Text></View>:null}
      {canRead&&listQuery.isError?<View style={styles.state}><Text style={styles.sectionTitle}>{listQuery.error instanceof ApiError&&listQuery.error.status===403?"Access not granted":"Events unavailable"}</Text><Text style={styles.muted}>{errorText(listQuery.error)}</Text><Pressable onPress={()=>{void listQuery.refetch();}} style={styles.secondary}><Text style={styles.secondaryText}>Retry</Text></Pressable></View>:null}
      {showCategoryForm&&canManage?<View style={styles.form}><Text style={styles.formTitle}>Create category</Text>
        <TextInput accessibilityLabel="Category name" value={categoryName} onChangeText={setCategoryName} style={styles.input} placeholder="Category name" placeholderTextColor={colors.textMuted}/>
        <TextInput accessibilityLabel="Category description" value={categoryDescription} onChangeText={setCategoryDescription} style={[styles.input,styles.multiline]} multiline placeholder="Description (optional)" placeholderTextColor={colors.textMuted}/>
        <View style={styles.actions}><Pressable accessibilityRole="button" disabled={categoryMutation.isPending} onPress={()=>categoryMutation.mutate()} style={styles.primary}><Text style={styles.primaryText}>{categoryMutation.isPending?"Saving…":"Create category"}</Text></Pressable><Pressable onPress={()=>setShowCategoryForm(false)} style={styles.secondary}><Text style={styles.secondaryText}>Close</Text></Pressable></View>
      </View>:null}
      {showForm&&canManage?<View style={styles.form}>
        <Text style={styles.formTitle}>{editingId?"Edit event":"Create event"}</Text>
        {textField("title","Event title",true)}
        {textField("shortDescription","Short description",false,true)}
        {textField("description","Full description",false,true)}
        {textField("eventDate","Event date (YYYY-MM-DD)",true)}
        {textField("startTime","Start time (optional)")}
        {textField("endTime","End time (optional)")}
        {textField("venue","Venue")}
        {choice("Category","categoryId",categories,categoriesQuery)}
        {permissions.includes("departments.read")?choice("Department scope","departmentId",departments,departmentsQuery):null}
        <Text style={styles.label}>Publication status</Text>
        <View style={styles.choices}>{(["DRAFT","PUBLISHED","ARCHIVED"] as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:draft.publicationStatus===value}} onPress={()=>setDraft(previous=>({...previous,publicationStatus:value}))} style={[styles.choice,draft.publicationStatus===value?styles.choiceSelected:null]}><Text style={[styles.choiceText,draft.publicationStatus===value?styles.choiceSelectedText:null]}>{value}</Text></Pressable>)}</View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:draft.isFeatured}} onPress={()=>setDraft(previous=>({...previous,isFeatured:!previous.isFeatured}))} style={styles.checkbox}><View style={[styles.check,draft.isFeatured?styles.checked:null]}><Text style={styles.checkmark}>{draft.isFeatured?"✓":""}</Text></View><Text style={styles.label}>Feature this event</Text></Pressable>
        {draft.coverImageUrl?<View style={styles.cover}><Image source={{uri:draft.coverImageUrl}} style={styles.coverImage} resizeMode="cover"/><Pressable accessibilityRole="button" onPress={()=>setDraft(previous=>({...previous,coverImageUrl:"",coverFileId:""}))} style={styles.secondary}><Text style={styles.secondaryText}>Remove cover</Text></Pressable></View>:null}
        <Pressable accessibilityRole="button" disabled={uploading||saveMutation.isPending} onPress={()=>{void uploadCover();}} style={[styles.secondary,(uploading||saveMutation.isPending)?styles.disabled:null]}><Text style={styles.secondaryText}>{uploading?"Uploading image…":draft.coverImageUrl?"Replace cover image":"Upload cover image"}</Text></Pressable>
        <Text style={styles.hint}>Images are uploaded immediately to the existing protected API using its 10 MB limit and server-side content-signature validation. Unsaved uploaded files may remain unattached if you cancel.</Text>
        <View style={styles.actions}><Pressable accessibilityRole="button" disabled={saveMutation.isPending||uploading} onPress={()=>saveMutation.mutate()} style={[styles.primary,saveMutation.isPending||uploading?styles.disabled:null]}><Text style={styles.primaryText}>{saveMutation.isPending?"Saving…":editingId?"Save event":"Create event"}</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>{setShowForm(false);setEditingId("");setDraft(emptyDraft());}} style={styles.secondary}><Text style={styles.secondaryText}>Cancel</Text></Pressable></View>
      </View>:null}
      {canRead&&!listQuery.isLoading&&!listQuery.isError&&!rows.length?<View style={styles.state}><Text style={styles.sectionTitle}>No events found</Text><Text style={styles.muted}>No authorized events match the current filters.</Text>{canManage?<Pressable onPress={beginCreate} style={styles.primary}><Text style={styles.primaryText}>Create first event</Text></Pressable>:null}</View>:null}
      {rows.map((event,index)=>{
        const id=idOf(event);const isSelected=id===selectedId;const eventMedia=Array.isArray(event.media)?event.media.map(object):[];
        return <View key={id||String(index)} style={[styles.eventCard,isSelected?styles.selectedCard:null]}>
          <Pressable accessibilityRole="button" onPress={()=>setSelectedId(isSelected?"":id)} style={styles.eventHeader}>
            <View style={{flex:1}}><Text style={styles.eventTitle}>{recordTitle(event,"Event "+String(index+1))}</Text><Text style={styles.muted}>{text(event.eventDate).slice(0,10)} · {text(event.venue)||"Venue not set"}</Text><Text style={styles.muted}>{text(object(event.category).name)||"Uncategorized"} · {text(object(event.department).name)||"Institution-wide"}</Text></View>
            <Text style={[styles.status,event.publicationStatus==="PUBLISHED"?styles.published:styles.unpublished]}>{text(event.publicationStatus)||"UNKNOWN"}</Text>
          </Pressable>
          {isSelected?<View style={styles.eventDetails}>
            {text(event.shortDescription)?<Text style={styles.bodyText}>{text(event.shortDescription)}</Text>:null}
            {text(event.description)?<Text style={styles.bodyText}>{text(event.description)}</Text>:null}
            {event.coverImageUrl&&typeof event.coverImageUrl==="string"?<Image source={{uri:event.coverImageUrl}} style={styles.coverImage} resizeMode="cover"/>:null}
            {canManage?<View style={styles.actions}><Pressable accessibilityRole="button" onPress={()=>beginEdit(event)} style={styles.secondary}><Text style={styles.secondaryText}>Edit event</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>{Alert.alert("Delete event?","This operation is checked by the event service and cannot be undone.",[{text:"Cancel",style:"cancel"},{text:"Delete",style:"destructive",onPress:()=>deleteMutation.mutate(id)}]);}} style={styles.danger}><Text style={styles.dangerText}>{deleteMutation.isPending&&deleteMutation.variables===id?"Deleting…":"Delete event"}</Text></Pressable><Pressable accessibilityRole="button" disabled={uploading} onPress={()=>{void addGalleryImage();}} style={styles.secondary}><Text style={styles.secondaryText}>{uploading?"Uploading…":"Add gallery image"}</Text></Pressable></View>:null}
            <Text style={styles.formTitle}>Gallery media ({eventMedia.length})</Text>
            {eventMedia.map((item,i)=>{const mediaId=idOf(item);return <View key={mediaId||String(i)} style={styles.galleryRow}>{typeof item.url==="string"?<Image source={{uri:item.url}} style={styles.galleryImage} resizeMode="cover"/>:null}<View style={{flex:1}}><Text style={styles.eventTitle}>{text(item.title)||"Gallery image"}</Text><Text style={styles.muted}>{text(item.altText)}</Text></View>{canManage?<Pressable accessibilityRole="button" onPress={()=>removeGalleryImage(mediaId)} style={styles.danger}><Text style={styles.dangerText}>Remove</Text></Pressable>:null}</View>;})}
          </View>:null}
        </View>;
      })}
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:colors.canvas},content:{paddingBottom:spacing.xl},header:{paddingHorizontal:spacing.lg,paddingTop:spacing.lg,paddingBottom:spacing.md,gap:9},eyebrow:{fontSize:10,fontWeight:"900",letterSpacing:1.4,color:colors.primary},title:{fontSize:24,fontWeight:"900",color:colors.text},muted:{fontSize:12,lineHeight:18,color:colors.textMuted},input:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:11,paddingVertical:10,color:colors.text,backgroundColor:colors.surface,fontSize:13},multiline:{minHeight:78,textAlignVertical:"top"},choices:{flexDirection:"row",flexWrap:"wrap",gap:6},choice:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:9,paddingVertical:8},choiceSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},choiceText:{fontSize:10,fontWeight:"800",color:colors.textMuted},choiceSelectedText:{color:colors.primary},actions:{flexDirection:"row",flexWrap:"wrap",gap:8},primary:{backgroundColor:colors.primary,borderRadius:radius.md,paddingHorizontal:13,paddingVertical:10,alignItems:"center",justifyContent:"center"},primaryText:{fontSize:12,fontWeight:"900",color:colors.white},secondary:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:11,paddingVertical:9,alignItems:"center",justifyContent:"center"},secondaryText:{fontSize:11,fontWeight:"800",color:colors.text},disabled:{opacity:.45},field:{gap:6,marginBottom:5},label:{fontSize:12,fontWeight:"800",color:colors.text},state:{padding:spacing.xl,alignItems:"center",gap:9},sectionTitle:{fontSize:16,fontWeight:"900",color:colors.text},form:{marginHorizontal:spacing.lg,marginBottom:spacing.lg,padding:spacing.md,backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,gap:10},formTitle:{fontSize:17,fontWeight:"900",color:colors.text,marginTop:4},hint:{fontSize:10,lineHeight:15,color:colors.textMuted},checkbox:{flexDirection:"row",gap:9,alignItems:"center"},check:{width:22,height:22,borderWidth:1,borderColor:colors.border,borderRadius:6,alignItems:"center",justifyContent:"center"},checked:{backgroundColor:colors.primary,borderColor:colors.primary},checkmark:{fontSize:14,fontWeight:"900",color:colors.white},cover:{gap:8},coverImage:{width:"100%",height:180,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},eventCard:{marginHorizontal:spacing.lg,marginBottom:9,padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surface},selectedCard:{borderColor:colors.primary},eventHeader:{flexDirection:"row",gap:8,alignItems:"flex-start"},eventTitle:{fontSize:13,fontWeight:"900",color:colors.text},status:{fontSize:9,fontWeight:"900",paddingHorizontal:8,paddingVertical:4,borderRadius:radius.pill,overflow:"hidden"},published:{backgroundColor:colors.primarySoft,color:colors.primary},unpublished:{backgroundColor:colors.surfaceMuted,color:colors.textMuted},eventDetails:{marginTop:9,paddingTop:9,borderTopWidth:1,borderTopColor:colors.border,gap:9},bodyText:{fontSize:12,lineHeight:18,color:colors.text},errorBox:{marginHorizontal:spacing.lg,marginBottom:spacing.md,padding:spacing.md,borderWidth:1,borderColor:colors.danger,borderRadius:radius.md},errorText:{fontSize:12,lineHeight:17,color:colors.danger},success:{marginHorizontal:spacing.lg,marginBottom:spacing.md,fontSize:12,fontWeight:"800",color:colors.success},danger:{borderWidth:1,borderColor:colors.danger,borderRadius:radius.md,paddingHorizontal:10,paddingVertical:8},dangerText:{fontSize:11,fontWeight:"900",color:colors.danger},galleryRow:{flexDirection:"row",alignItems:"center",gap:8,paddingVertical:7,borderBottomWidth:1,borderBottomColor:colors.surfaceMuted},galleryImage:{width:60,height:55,borderRadius:radius.sm,backgroundColor:colors.surfaceMuted}
});
