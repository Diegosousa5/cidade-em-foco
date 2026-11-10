package br.edu.cidadeemfoco.repository;

import br.edu.cidadeemfoco.model.Ocorrencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface OcorrenciaRepository extends JpaRepository<Ocorrencia, Long> {

    @Query(value = """
        SELECT o.*
        FROM public.ocorrencias o
        WHERE ST_Intersects(
            o.localizacao,
            ST_MakeEnvelope(
                :minLongitude,
                :minLatitude,
                :maxLongitude,
                :maxLatitude,
                4326
            )
        )
        ORDER BY o.data_criacao DESC
        """, nativeQuery = true)
    List<Ocorrencia> findWithinBoundingBox(
        @Param("minLatitude") double minLatitude,
        @Param("minLongitude") double minLongitude,
        @Param("maxLatitude") double maxLatitude,
        @Param("maxLongitude") double maxLongitude
    );

    @Query(value = """
        SELECT o.*
        FROM public.ocorrencias o
        WHERE ST_DWithin(
            CAST(o.localizacao AS geography),
            CAST(ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326) AS geography),
            :raioMetros
        )
        ORDER BY o.data_criacao DESC
        """, nativeQuery = true)
    List<Ocorrencia> findWithinRadius(
        @Param("latitude") double latitude,
        @Param("longitude") double longitude,
        @Param("raioMetros") double raioMetros
    );
}
