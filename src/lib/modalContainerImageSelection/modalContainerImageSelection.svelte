<script>    

    let { targetImageElement, modalId } = $props();

    console.log("data in modalContainerImageSelection", targetImageElement);

    const imageModules = import.meta.glob(
        '$lib/containerImages/*.{avif,gif,heif,jpeg,jpg,png,tiff,webp,svg}',
        {
            eager: true,
            query: {
                enhanced: false
            }
        }
    )
</script>

<div id="{ modalId }" class="modal fade">
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Select Image</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="row">
                    {#each Object.entries(imageModules) as [path, module]}
                        <button type="button" class="col-3 mb-3 text-center btn p-1" onclick={() => { targetImageElement.src = module.default.img.src; targetImageElement.id = "/" + path.split('/').pop(); }} aria-label="Select image" data-bs-dismiss="modal">
                            <enhanced:img src={module.default} class="img-thumbnail" alt="some alt text" style="width: 100%; height: 170px; object-fit: contain; background-color: #ffffff; cursor: pointer;" />
                            <small class="text-muted">{path.split('/').pop()}</small> <!-- Display the filename as caption -->
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    </div>
</div>