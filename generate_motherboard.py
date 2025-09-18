import bpy
import bmesh
from mathutils import Vector
import math

def clear_scene():
    """Clear all objects from the scene"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def create_motherboard_base():
    """Create the main motherboard PCB"""
    # Standard ATX motherboard dimensions (305mm x 244mm)
    width = 0.305
    height = 0.244
    thickness = 0.0016  # 1.6mm PCB thickness
    
    bpy.ops.mesh.primitive_cube_add(size=1)
    motherboard = bpy.context.active_object
    motherboard.name = "Motherboard_PCB"
    motherboard.scale = (width, height, thickness)
    motherboard.location = (0, 0, thickness/2)
    
    # Create PCB material (green)
    pcb_material = bpy.data.materials.new(name="PCB_Material")
    pcb_material.use_nodes = True
    pcb_material.node_tree.nodes.clear()
    
    # Add Principled BSDF
    bsdf = pcb_material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.1, 0.4, 0.1, 1.0)  # Dark green
    bsdf.inputs['Roughness'].default_value = 0.8
    bsdf.inputs['Metallic'].default_value = 0.0
    
    # Add output
    output = pcb_material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
    pcb_material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    motherboard.data.materials.append(pcb_material)
    
    return motherboard

def create_cpu_socket():
    """Create CPU socket (LGA1700 style)"""
    bpy.ops.mesh.primitive_cube_add(size=1)
    cpu_socket = bpy.context.active_object
    cpu_socket.name = "CPU_Socket"
    cpu_socket.scale = (0.0375, 0.0375, 0.003)  # 37.5mm x 37.5mm
    cpu_socket.location = (-0.08, 0.05, 0.003)
    
    # CPU socket material (black plastic)
    socket_material = bpy.data.materials.new(name="Socket_Material")
    socket_material.use_nodes = True
    socket_material.node_tree.nodes.clear()
    
    bsdf = socket_material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.05, 0.05, 0.05, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.6
    bsdf.inputs['Metallic'].default_value = 0.0
    
    output = socket_material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
    socket_material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    cpu_socket.data.materials.append(socket_material)
    
    return cpu_socket

def create_ram_slots():
    """Create RAM slots (DDR4/DDR5)"""
    ram_slots = []
    slot_positions = [
        (-0.12, 0.08, 0.002),   # DIMM1
        (-0.12, 0.12, 0.002),   # DIMM2
        (-0.12, -0.08, 0.002),  # DIMM3
        (-0.12, -0.12, 0.002),  # DIMM4
    ]
    
    for i, pos in enumerate(slot_positions):
        bpy.ops.mesh.primitive_cube_add(size=1)
        ram_slot = bpy.context.active_object
        ram_slot.name = f"RAM_Slot_{i+1}"
        ram_slot.scale = (0.133, 0.005, 0.002)  # 133mm x 5mm
        ram_slot.location = pos
        
        # RAM slot material (black)
        slot_material = bpy.data.materials.new(name=f"RAM_Slot_Material_{i+1}")
        slot_material.use_nodes = True
        slot_material.node_tree.nodes.clear()
        
        bsdf = slot_material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = (0.1, 0.1, 0.1, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.7
        bsdf.inputs['Metallic'].default_value = 0.0
        
        output = slot_material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
        slot_material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        
        ram_slot.data.materials.append(slot_material)
        ram_slots.append(ram_slot)
    
    return ram_slots

def create_pcie_slots():
    """Create PCIe slots"""
    pcie_slots = []
    slot_positions = [
        (0.05, 0.0, 0.002),     # PCIe x16 (GPU)
        (0.05, -0.05, 0.002),   # PCIe x1
        (0.05, -0.1, 0.002),    # PCIe x1
    ]
    
    for i, pos in enumerate(slot_positions):
        bpy.ops.mesh.primitive_cube_add(size=1)
        pcie_slot = bpy.context.active_object
        pcie_slot.name = f"PCIe_Slot_{i+1}"
        
        if i == 0:  # GPU slot (x16)
            pcie_slot.scale = (0.089, 0.011, 0.002)  # 89mm x 11mm
        else:  # x1 slots
            pcie_slot.scale = (0.025, 0.011, 0.002)  # 25mm x 11mm
            
        pcie_slot.location = pos
        
        # PCIe slot material (black)
        slot_material = bpy.data.materials.new(name=f"PCIe_Slot_Material_{i+1}")
        slot_material.use_nodes = True
        slot_material.node_tree.nodes.clear()
        
        bsdf = slot_material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = (0.1, 0.1, 0.1, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.7
        bsdf.inputs['Metallic'].default_value = 0.0
        
        output = slot_material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
        slot_material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        
        pcie_slot.data.materials.append(slot_material)
        pcie_slots.append(pcie_slot)
    
    return pcie_slots

def create_m2_slots():
    """Create M.2 NVMe slots"""
    m2_slots = []
    slot_positions = [
        (-0.05, 0.0, 0.002),    # M.2_1
        (0.0, -0.15, 0.002),    # M.2_2
    ]
    
    for i, pos in enumerate(slot_positions):
        bpy.ops.mesh.primitive_cube_add(size=1)
        m2_slot = bpy.context.active_object
        m2_slot.name = f"M2_Slot_{i+1}"
        m2_slot.scale = (0.022, 0.08, 0.001)  # 22mm x 80mm
        m2_slot.location = pos
        
        # M.2 slot material (gold)
        slot_material = bpy.data.materials.new(name=f"M2_Slot_Material_{i+1}")
        slot_material.use_nodes = True
        slot_material.node_tree.nodes.clear()
        
        bsdf = slot_material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = (0.8, 0.6, 0.2, 1.0)  # Gold
        bsdf.inputs['Roughness'].default_value = 0.3
        bsdf.inputs['Metallic'].default_value = 0.8
        
        output = slot_material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
        slot_material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        
        m2_slot.data.materials.append(slot_material)
        m2_slots.append(m2_slot)
    
    return m2_slots

def create_sata_ports():
    """Create SATA ports"""
    sata_ports = []
    port_positions = [
        (0.08, -0.15, 0.002),
        (0.08, -0.12, 0.002),
        (0.08, -0.09, 0.002),
        (0.08, -0.06, 0.002),
    ]
    
    for i, pos in enumerate(port_positions):
        bpy.ops.mesh.primitive_cube_add(size=1)
        sata_port = bpy.context.active_object
        sata_port.name = f"SATA_Port_{i+1}"
        sata_port.scale = (0.007, 0.015, 0.001)  # 7mm x 15mm
        sata_port.location = pos
        
        # SATA port material (black)
        port_material = bpy.data.materials.new(name=f"SATA_Port_Material_{i+1}")
        port_material.use_nodes = True
        port_material.node_tree.nodes.clear()
        
        bsdf = port_material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = (0.1, 0.1, 0.1, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.7
        bsdf.inputs['Metallic'].default_value = 0.0
        
        output = port_material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
        port_material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        
        sata_port.data.materials.append(port_material)
        sata_ports.append(sata_port)
    
    return sata_ports

def create_power_connectors():
    """Create power connectors (24-pin ATX, 8-pin CPU)"""
    power_connectors = []
    
    # 24-pin ATX power connector
    bpy.ops.mesh.primitive_cube_add(size=1)
    atx_power = bpy.context.active_object
    atx_power.name = "ATX_Power_24pin"
    atx_power.scale = (0.021, 0.005, 0.002)  # 21mm x 5mm
    atx_power.location = (0.12, 0.0, 0.002)
    
    # 8-pin CPU power connector
    bpy.ops.mesh.primitive_cube_add(size=1)
    cpu_power = bpy.context.active_object
    cpu_power.name = "CPU_Power_8pin"
    cpu_power.scale = (0.015, 0.005, 0.002)  # 15mm x 5mm
    cpu_power.location = (0.12, 0.08, 0.002)
    
    # Power connector material (black)
    power_material = bpy.data.materials.new(name="Power_Connector_Material")
    power_material.use_nodes = True
    power_material.node_tree.nodes.clear()
    
    bsdf = power_material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.1, 0.1, 0.1, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.7
    bsdf.inputs['Metallic'].default_value = 0.0
    
    output = power_material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
    power_material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    atx_power.data.materials.append(power_material)
    cpu_power.data.materials.append(power_material)
    
    power_connectors.extend([atx_power, cpu_power])
    return power_connectors

def create_vrm_heatsinks():
    """Create VRM heatsinks"""
    vrm_heatsinks = []
    
    # CPU VRM heatsink
    bpy.ops.mesh.primitive_cube_add(size=1)
    cpu_vrm = bpy.context.active_object
    cpu_vrm.name = "CPU_VRM_Heatsink"
    cpu_vrm.scale = (0.08, 0.03, 0.015)  # 80mm x 30mm x 15mm
    cpu_vrm.location = (-0.15, 0.05, 0.015)
    
    # Chipset heatsink
    bpy.ops.mesh.primitive_cube_add(size=1)
    chipset_vrm = bpy.context.active_object
    chipset_vrm.name = "Chipset_Heatsink"
    chipset_vrm.scale = (0.04, 0.04, 0.01)  # 40mm x 40mm x 10mm
    chipset_vrm.location = (0.0, -0.15, 0.01)
    
    # VRM heatsink material (aluminum)
    vrm_material = bpy.data.materials.new(name="VRM_Heatsink_Material")
    vrm_material.use_nodes = True
    vrm_material.node_tree.nodes.clear()
    
    bsdf = vrm_material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.7, 0.7, 0.7, 1.0)  # Silver
    bsdf.inputs['Roughness'].default_value = 0.4
    bsdf.inputs['Metallic'].default_value = 0.8
    
    output = vrm_material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
    vrm_material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    cpu_vrm.data.materials.append(vrm_material)
    chipset_vrm.data.materials.append(vrm_material)
    
    vrm_heatsinks.extend([cpu_vrm, chipset_vrm])
    return vrm_heatsinks

def create_io_panel():
    """Create I/O panel"""
    bpy.ops.mesh.primitive_cube_add(size=1)
    io_panel = bpy.context.active_object
    io_panel.name = "IO_Panel"
    io_panel.scale = (0.001, 0.15, 0.05)  # 1mm x 150mm x 50mm
    io_panel.location = (0.153, 0.0, 0.025)
    
    # I/O panel material (black)
    io_material = bpy.data.materials.new(name="IO_Panel_Material")
    io_material.use_nodes = True
    io_material.node_tree.nodes.clear()
    
    bsdf = io_material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.05, 0.05, 0.05, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.8
    bsdf.inputs['Metallic'].default_value = 0.0
    
    output = io_material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
    io_material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    io_panel.data.materials.append(io_material)
    return io_panel

def create_motherboard_group():
    """Group all motherboard components"""
    # Select all objects
    bpy.ops.object.select_all(action='SELECT')
    
    # Create group
    bpy.ops.object.join()
    motherboard_group = bpy.context.active_object
    motherboard_group.name = "Motherboard_Complete"
    
    return motherboard_group

def main():
    """Main function to generate the motherboard"""
    print("Generating PC Motherboard...")
    
    # Clear scene
    clear_scene()
    
    # Create motherboard components
    motherboard_base = create_motherboard_base()
    cpu_socket = create_cpu_socket()
    ram_slots = create_ram_slots()
    pcie_slots = create_pcie_slots()
    m2_slots = create_m2_slots()
    sata_ports = create_sata_ports()
    power_connectors = create_power_connectors()
    vrm_heatsinks = create_vrm_heatsinks()
    io_panel = create_io_panel()
    
    # Group everything
    motherboard_group = create_motherboard_group()
    
    # Set origin to center
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='MEDIAN')
    
    print("Motherboard generation complete!")
    print("Components created:")
    print("- Main PCB (ATX form factor)")
    print("- CPU Socket (LGA1700)")
    print("- 4x RAM Slots (DDR4/DDR5)")
    print("- 3x PCIe Slots (1x x16, 2x x1)")
    print("- 2x M.2 NVMe Slots")
    print("- 4x SATA Ports")
    print("- Power Connectors (24-pin ATX, 8-pin CPU)")
    print("- VRM Heatsinks")
    print("- I/O Panel")

if __name__ == "__main__":
    main()
