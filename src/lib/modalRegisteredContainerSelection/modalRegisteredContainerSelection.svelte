<script>    

    import { editedJSON } from "../../routes/stores";

    let { targetImageElement, targetTextElement, modalId } = $props();

    let containerList = $editedJSON.containerData;

    console.log("data in modalContainerImageSelection", targetImageElement);
    console.log("containerList", containerList);

    const imageModules = /** @type {Record<string, any>} */ (import.meta.glob(
        '$lib/containerImages/*.{avif,gif,heif,jpeg,jpg,png,tiff,webp,svg}',
        {
            eager: true,
            query: {
                enhanced: false
            }
        }
    ))

    const placeholderKey = '/src/lib/containerImages/placeholder.jpg';
    const placeholderDefault =
        imageModules[placeholderKey]?.default || Object.values(imageModules)[0]?.default;

    /** @param {string} src */
    function normalizeImagePath(src) {
        if (!src || typeof src !== 'string') {
            return '/placeholder.jpg';
        }

        const withSlash = src.startsWith('/') ? src : `/${src}`;
        try {
            return decodeURIComponent(withSlash);
        } catch {
            return withSlash;
        }
    }

    /** @param {string} src */
    function resolveImageModule(src) {
        const normalizedPath = normalizeImagePath(src);
        const key = `/src/lib/containerImages${normalizedPath}`;
        const module = imageModules[key];

        if (module?.default) {
            return {
                asset: module.default,
                path: normalizedPath,
            };
        }

        return {
            asset: placeholderDefault,
            path: '/placeholder.jpg',
        };
    }

    /** @param {string} src */
    function getModuleDefault(src) {
        return resolveImageModule(src).asset;
    }

    /** @param {string} src */
    function getImageSrc(src) {
        return resolveImageModule(src).asset?.img?.src || "";
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
                        <button type="button" class="col-3 mb-3 btn p-1" onclick={() => { if(container.imageSrc.blocks && container.imageSrc.blocks.length>0) {const resolved = resolveImageModule(container.imageSrc.blocks[0].data.imageSrc); targetImageElement.src = resolved.asset?.img?.src || ""; targetImageElement.id = resolved.path;} else {targetImageElement.src = getImageSrc('/placeholder.jpg'); targetImageElement.id = "/placeholder.jpg"}; targetTextElement.innerText =  "##" + container.code.blocks[0].data.text +"##"; }} aria-label="Select image" data-bs-dismiss="modal">
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