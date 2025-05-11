<script>    

    import { editedJSON } from "../../routes/stores";

    let { targetImageElement, targetTextElement, modalId } = $props();

    let containerList = $editedJSON.containerData;

    console.log("data in modalContainerImageSelection", targetImageElement);
    console.log("containerList", containerList);

    const imageModules = import.meta.glob(
        '$lib/containerImages/*.{avif,gif,heif,jpeg,jpg,png,tiff,webp,svg}',
        {
            eager: true,
            query: {
                enhanced: false
            }
        }
    )

    function getModuleDefault(src) {
        return imageModules["/src/lib/containerImages" + src.replace("%20", " ")].default;
    }
</script>

<div id="{ modalId }" class="modal fade">
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Select Registered Containers</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="row">
                    {#each containerList as container}
                        <button type="button" class="col-3 mb-3 btn p-1" onclick={() => { if(container.imageSrc.blocks && container.imageSrc.blocks.length>0) {targetImageElement.src = getModuleDefault(container.imageSrc.blocks[0].data.imageSrc).img.src; targetImageElement.id = container.imageSrc.blocks[0].data.imageSrc} else {targetImageElement.src= imageModules['/src/lib/containerImages/placeholder.jpg']?.default.img.src ||"" ; targetImageElement.id = "/placeholder.jpg"}; targetTextElement.innerText =  "##" + container.code.blocks[0].data.text +"##"; }} aria-label="Select image" data-bs-dismiss="modal">
                            <div class="card bg-primary-subtle">
                            <div class="card-body">

                            <p class="card-text">{container.name.blocks[0].data.text}</p>
                            
                            {#if container.imageSrc.blocks && container.imageSrc.blocks.length>0}

                            <enhanced:img src={getModuleDefault(container.imageSrc.blocks[0].data.imageSrc)} class="img-thumbnail" style="width: 100%; cursor: pointer;" />
                            
                            {:else}
                            <enhanced:img src={getModuleDefault("/placeholder.jpg")} class="img-thumbnail" style="width: 100%; cursor: pointer;" />
                            
                            {/if}
                        
                        </div>
                        </div>
                        </button>
                    {/each}
                    
                </div>
            </div>
        </div>
    </div>
</div>