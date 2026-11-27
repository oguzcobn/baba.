"""Rebuild Rocketbox GLBs with Blender 4.x. Run download-people.py first."""
import bpy,sys,math
from pathlib import Path
from mathutils import Quaternion
src,out=map(Path,sys.argv[-2:])
for name,role in [('Construction_Male_02','crew-a'),('Construction_Female_01','crew-b'),('Military_Male_01','infantry')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(src/(name+'.fbx')),use_anim=False)
    scene=bpy.context.scene
    rig=next(o for o in scene.objects if o.type=='ARMATURE')
    mesh=next(o for o in scene.objects if o.type=='MESH')
    for mat in mesh.data.materials:
        tex=next(src.glob(mat.name+'_color*.jpg'))
        mat.use_nodes=True
        nodes=mat.node_tree.nodes
        nodes.clear()
        output=nodes.new('ShaderNodeOutputMaterial')
        shader=nodes.new('ShaderNodeBsdfPrincipled')
        image=nodes.new('ShaderNodeTexImage')
        image.image=bpy.data.images.load(str(tex))
        image.image.pack()
        mat.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface'])
        mat.node_tree.links.new(image.outputs['Color'],shader.inputs['Base Color'])
        shader.inputs['Roughness'].default_value=.84
    dec=mesh.modifiers.new('RTS topology','DECIMATE')
    dec.ratio=.55
    bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.modifier_move_to_index(modifier=dec.name,index=0)
    bpy.ops.object.modifier_apply(modifier=dec.name)
    actions=[]
    for kind in ['idle','walk','work','carry','carryIdle','ready']:
        rig.animation_data_clear()
        for bone in rig.pose.bones:bone.matrix_basis.identity()
        action=bpy.data.actions.new(kind)
        rig.animation_data_create().action=action
        for frame in range(0,25,3):
            t=2*math.pi*frame/24
            moving=kind in ('walk','carry')
            work=kind=='work'
            carry=kind in ('carry','carryIdle')
            def rotate(bone,x=0,y=0,z=0):
                p=rig.pose.bones.get('Bip01 '+bone)
                if not p:return
                rest=(rig.matrix_world@p.bone.matrix_local).to_quaternion()
                q=Quaternion((1,0,0),math.radians(x))@Quaternion((0,1,0),math.radians(y))@Quaternion((0,0,1),math.radians(z))
                p.rotation_mode='QUATERNION'
                p.rotation_quaternion=rest.inverted()@q@rest
                p.keyframe_insert('rotation_quaternion',frame=frame,group=bone)
            for side,sign in [('L',1),('R',-1)]:
                wave=math.sin(t)*sign
                rotate(side+' Thigh',x=-23*wave-5 if moving else -3)
                fold=8+34*max(0,-wave) if moving else 6
                rotate(side+' Calf',x=fold)
                rotate(side+' Foot',x=-(fold*.55)+9*wave if moving else -3)
                rotate(side+' UpperArm',x=-26 if carry else -22+14*wave if work else -17 if kind=='ready' else 16*wave if moving else 1.5*wave,y=sign*(32 if carry else 38))
                rotate(side+' Forearm',x=-65 if carry else -42-18*wave if work else -50 if kind=='ready' else -14-7*max(0,wave),z=-sign*(22 if carry or kind=='ready' else 4))
            rotate('Spine1',x=9+5*math.cos(t) if work else 4 if carry else 1+.9*math.sin(t),z=3*math.sin(t) if moving else 0)
            rotate('Head',x=6 if work else -1,z=2*math.sin(t))
        actions.append(action)
        action.use_fake_user=True
    rig.animation_data.action=None
    for action in actions:
        track=rig.animation_data.nla_tracks.new()
        track.name=action.name
        track.strips.new(action.name,0,action)
        track.mute=True
    scene.render.fps=24
    bpy.ops.export_scene.gltf(filepath=str(out/(role+'.glb')),export_format='GLB',export_animation_mode='NLA_TRACKS',export_yup=True,export_force_sampling=True,export_skins=True,export_image_format='JPEG',export_jpeg_quality=84)
    crowd=mesh.modifiers.new('Distant 3D topology','DECIMATE')
    crowd.ratio=.20
    bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.modifier_move_to_index(modifier=crowd.name,index=0)
    bpy.ops.object.modifier_apply(modifier=crowd.name)
    bpy.ops.export_scene.gltf(filepath=str(out/(role+'-lod.glb')),export_format='GLB',export_animation_mode='NLA_TRACKS',export_yup=True,export_force_sampling=True,export_skins=True,export_image_format='JPEG',export_jpeg_quality=78)
